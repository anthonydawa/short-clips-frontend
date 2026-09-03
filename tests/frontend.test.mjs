import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSourceVideo, validateVideoFile, validateYouTubeUrl, MAX_VIDEO_BYTES } from '../js/uploads.js';

globalThis.window = { SHOORT_CLIPS_CONFIG: { MOCK_MODE: false, AUTH_ENABLED: false, API_BASE_URL: 'https://api.example.test' } };
const { CONFIG } = await import('../js/config.js');
const { getMediaUrl, safeMediaUrl, escapeHtml } = await import('../js/media.js');
const { state } = await import('../js/state.js');
const { api } = await import('../js/api.js');
const { getJobCompletion } = await import('../js/jobCompletion.js');
const { getClipMediaIssue } = await import('../js/media.js');
const partSize = 5 * 1024 ** 2;

test('placeholder media links cannot become playable clips or successful batches', () => {
  const clip = { assets: { video: { url: 'https://media.staging.shoortclips.com/users/test/jobs/1/video.mp4' } } };
  assert.equal(getMediaUrl(clip, 'video'), '');
  assert.match(getClipMediaIssue(clip), /placeholder/);
  assert.equal(getJobCompletion({ job: { status: 'completed', requested_clip_count: 5 }, clips: Array(5).fill(clip) }).stage, 'FAILED');
  assert.equal(getJobCompletion({ job: { status: 'completed' }, clips: [] }).stage, 'FAILED');
});

test('batch completion distinguishes missing media, partial output, and available clips', () => {
  const clip = { assets: { video: { url: 'https://media.example.test/video.mp4' } } };
  assert.equal(getJobCompletion({job: {requested_clip_count: 5}, clips: [clip]}).stage, 'PARTIAL');
  assert.equal(getJobCompletion({job: {requested_clip_count: 2}, clips: [clip, {}]}).stage, 'FAILED');
  assert.equal(getJobCompletion({job: {requested_clip_count: 5}, clips: Array(5).fill(clip)}).stage, 'COMPLETED');
  assert.equal(getJobCompletion({job: {status: 'failed'}, clips: [clip]}).stage, 'FAILED');
});

function setupUpload(t, { size = partSize + 7, behavior, requestHook } = {}) {
  const writes = [];
  const requests = [];
  let attempts = 0;
  class XHR {
    upload = {};
    status = 200;
    headers = {};
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    getResponseHeader() { return this.etag === undefined ? '"etag-value"' : this.etag; }
    abort() { this.onabort(); }
    send(blob) {
      writes.push({ method: this.method, url: this.url, headers: this.headers, size: blob.size, credentials: this.withCredentials });
      queueMicrotask(() => {
        attempts++;
        if (behavior?.(this, attempts) === false) return;
        this.upload.onprogress({ loaded: blob.size });
        this.onload();
      });
    }
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const old = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = XHR;
  t.after(() => { globalThis.XMLHttpRequest = old; });
  const file = new File([new Uint8Array(size)], 'source.mp4', { type: 'video/mp4' });
  const request = async (endpoint, options) => {
    requests.push({ endpoint, options, body: options.body ? JSON.parse(options.body) : null });
    const override = await requestHook?.(endpoint, options);
    if (override !== undefined) return override;
    if (endpoint === '/api/v1/uploads') return { upload_id: 'upl_a', part_size_bytes: partSize };
    if (endpoint.includes('/parts/')) return { url: `https://account.r2.cloudflarestorage.com/bucket/video?signature=${requests.length}`, headers: {} };
    if (endpoint.endsWith('/complete')) return { source_upload_id: 'upl_a' };
    if (options.method === 'DELETE') return null;
    throw new Error(`Unexpected API call ${endpoint}`);
  };
  return { file, request, requests, writes };
}

test('file validation enforces nonempty allowed videos and the 2 GiB boundary', () => {
  assert.equal(validateVideoFile({ name: 'CAMERA.MOV', type: '', size: MAX_VIDEO_BYTES }), 'video/quicktime');
  for (const file of [null, { name: 'clip.mp4', size: 0 }, { name: 'clip.mp4', size: MAX_VIDEO_BYTES + 1 }, { name: 'bad.svg', size: 7 }, { name: 'bad.mp4', type: 'text/html', size: 7 }]) {
    assert.throws(() => validateVideoFile(file));
  }
});

test('YouTube validation rejects unrelated hosts and channel pages', () => {
  assert.equal(validateYouTubeUrl('https://youtu.be/abcdefghijk'), 'https://youtu.be/abcdefghijk');
  assert.equal(validateYouTubeUrl('https://www.youtube.com/watch?v=abcdefghijk&t=20'), 'https://www.youtube.com/watch?v=abcdefghijk&t=20');
  for (const value of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://youtube.com/@channel', 'javascript:alert(1)', 'https://name:secret@youtube.com/watch?v=abcdefghijk']) assert.throws(() => validateYouTubeUrl(value));
});

test('multipart sends exact file slices only to R2 and completes with ordered ETags', async (t) => {
  const { file, request, requests, writes } = setupUpload(t);
  const progress = [];
  assert.equal(await uploadSourceVideo(file, request, { onProgress: (value) => progress.push(value) }), 'upl_a');
  assert.deepEqual(writes.map((write) => write.size), [partSize, 7]);
  assert.ok(writes.every((write) => write.method === 'PUT' && !write.headers.Authorization && !write.credentials));
  assert.deepEqual(requests.at(-1).body.parts, [{ part_number: 1, etag: '"etag-value"' }, { part_number: 2, etag: '"etag-value"' }]);
  assert.equal(progress.at(-1).loaded, file.size);
  assert.equal(requests.some(({ options }) => options.method === 'DELETE'), false);
});

test('failed part is re-signed and retried without duplicating its manifest entry', async (t) => {
  const { file, request, requests, writes } = setupUpload(t, { size: 9, behavior: (xhr, attempt) => { if (attempt === 1) xhr.status = 403; } });
  await uploadSourceVideo(file, request);
  assert.equal(writes.length, 2);
  assert.notEqual(writes[0].url, writes[1].url);
  assert.equal(requests.at(-1).body.parts.length, 1);
});

test('missing CORS ETag fails after bounded retries and aborts the session', async (t) => {
  const { file, request, requests, writes } = setupUpload(t, { size: 9, behavior: (xhr) => { xhr.etag = null; } });
  await assert.rejects(uploadSourceVideo(file, request), /ETag/);
  assert.equal(writes.length, 3);
  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(requests.some(({ endpoint }) => endpoint.endsWith('/complete')), false);
});

test('cancellation aborts transfer and cleans up without completing an object', async (t) => {
  const controller = new AbortController();
  const { file, request, requests } = setupUpload(t, { behavior: () => { controller.abort(); return false; } });
  await assert.rejects(uploadSourceVideo(file, request, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(requests.at(-1).options.signal, undefined);
  assert.equal(requests.some(({ endpoint }) => endpoint.endsWith('/complete')), false);
});

test('cancel during session creation still cleans up the allocated upload', async (t) => {
  const controller = new AbortController();
  const { file, request, requests, writes } = setupUpload(t, { requestHook: (endpoint) => { if (endpoint === '/api/v1/uploads') controller.abort(); } });
  await assert.rejects(uploadSourceVideo(file, request, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(writes.length, 0);
  assert.equal(requests.at(-1).options.method, 'DELETE');
});

test('an unrelated signed upload destination never receives file bytes', async (t) => {
  const { file, request, writes, requests } = setupUpload(t, { requestHook: (endpoint) => endpoint.includes('/parts/') ? { url: 'https://evil.example/upload' } : undefined });
  await assert.rejects(uploadSourceVideo(file, request), /valid signed R2/);
  assert.equal(writes.length, 0);
  assert.equal(requests.at(-1).options.method, 'DELETE');
});

test('API upload creates a JSON job only after object completion', async (t) => {
  // Node cannot load the browser's remote Supabase SDK. Authentication is
  // outside this transport test; its caught initialization warning is expected.
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const fixture = setupUpload(t, { size: 9 });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    const value = path === '/api/v1/jobs/submit' ? { video_id: 'vid_a' } : await fixture.request(path, options);
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const result = await api.uploadVideo(fixture.file, { brand_id: 'brand_a', target_clip_count: 3 });
  assert.equal(result.video_id, 'vid_a');
  assert.equal(calls.at(-2).path, '/api/v1/uploads/upl_a/complete');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { brand_id: 'brand_a', target_clip_count: 3, source_upload_id: 'upl_a' });
  assert.ok(calls.every(({ options }) => !(options.body instanceof FormData)));
});

test('API accepts empty 204 and surfaces FastAPI validation errors readably', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api.deleteJob('vid_a'), null);
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [{ msg: 'Invalid source' }] }), { status: 422 });
  await assert.rejects(api.submitJob({}), /Invalid source/);
});

test('media supports signed assets, escapes display strings, and disables workspace URLs by default', () => {
  const signed = 'https://account.r2.cloudflarestorage.com/bucket/video.mp4?sig=a&expires=b';
  assert.equal(getMediaUrl({ assets: { video: { url: signed } } }, 'video'), signed);
  assert.equal(getMediaUrl({ r2_thumbnail_url: signed }, 'thumbnail'), signed);
  assert.equal(getMediaUrl({ video_path: 'C:\\private\\clip.mp4', video_id: 'vid_a' }, 'video'), '');
  assert.equal(safeMediaUrl('javascript:alert(1)'), '');
  assert.equal(safeMediaUrl('https://name:secret@example.com/image'), '');
  assert.equal(escapeHtml('<img onerror="bad">'), '&lt;img onerror=&quot;bad&quot;&gt;');
  assert.equal(CONFIG.ALLOW_LOCAL_MEDIA, false);
});

test('new batches select and notify the player; refreshed URLs replace stale selection', () => {
  state.clearUserData();
  const selected = [];
  const unsubscribe = state.subscribe((_, action) => { if (action === 'SELECTED_CLIP_CHANGED') selected.push(state.selectedClip); });
  const oldClip = { clip_uid: 'clip_a', r2_video_url: 'https://example.test/old' };
  const refreshed = { ...oldClip, r2_video_url: 'https://example.test/new' };
  const secondJobClip = { clip_uid: 'clip_b' };
  state.setClips([oldClip]);
  state.setClips([refreshed]);
  state.setClips([secondJobClip]);
  state.setClips([]);
  unsubscribe();
  assert.deepEqual(selected, [oldClip, refreshed, secondJobClip, null]);
});
