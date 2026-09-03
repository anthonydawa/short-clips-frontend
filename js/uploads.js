// Browser-side R2 multipart transport. The API owns/signs the upload session;
// only this module sends file bytes, directly to the signed R2 URL.
export const MAX_VIDEO_BYTES = 2 * 1024 ** 3;
const VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo' };

export function validateVideoFile(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('Choose a non-empty video file.');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('The video must be 2 GiB or smaller.');
  const extension = file.name?.split('.').pop().toLowerCase();
  const contentType = VIDEO_TYPES[extension];
  if (!contentType || (file.type && !file.type.startsWith('video/') && file.type !== 'application/octet-stream')) {
    throw new Error('Choose an MP4, MOV, MKV, or AVI video.');
  }
  return contentType;
}

export function validateYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) throw new Error();
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live|embed)\/([^/]+)\/?$/.exec(url.pathname)?.[2];
    if (!/^[\w-]{11}$/.test(id || '')) throw new Error();
    return url.href;
  } catch (_) {
    throw new Error('Enter a YouTube video link, such as https://www.youtube.com/watch?v=VIDEO_ID.');
  }
}

function putPart(part, blob, signal, onProgress) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Upload cancelled.', 'AbortError'));
    const url = new URL(part.url);
    const isR2 = url.hostname.endsWith('.r2.cloudflarestorage.com');
    const isLocalOrMock = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === 'mock-r2.invalid' || url.hostname.includes('staging');
    if ((!isR2 && !isLocalOrMock) || url.username || url.password) {
      return reject(new Error('The API did not return a valid signed R2 upload URL.'));
    }
    if (url.hostname === 'mock-r2.invalid') {
      onProgress(blob.size);
      return resolve('mock_etag_local_' + Date.now());
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error, result) => {
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(result);
    };
    xhr.open('PUT', url.href);
    xhr.timeout = 5 * 60 * 1000;
    // Deliberately no Authorization header or cross-origin cookies.
    for (const [name, value] of Object.entries(part.headers || {})) {
      if (name.toLowerCase() !== 'content-type') return reject(new Error('Unsupported upload header returned by the API.'));
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => onProgress(Math.min(event.loaded, blob.size));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return finish(new Error(`Part upload failed (HTTP ${xhr.status}).`));
      const etag = xhr.getResponseHeader('ETag');
      if (!etag) return finish(new Error('R2 did not expose an ETag. Check the bucket CORS policy.'));
      finish(null, etag);
    };
    xhr.onerror = () => finish(new Error('Upload connection failed. Check your connection and R2 CORS settings.'));
    xhr.ontimeout = () => finish(new Error('Part upload timed out. Please try again.'));
    xhr.onabort = () => finish(new DOMException('Upload cancelled.', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    xhr.send(blob);
  });
}

export async function uploadSourceVideo(file, request, { signal, onProgress = () => {} } = {}) {
  const contentType = validateVideoFile(file);
  let session;
  let completed = false;
  const checkCancelled = () => { if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError'); };
  try {
    checkCancelled();
    // Let initiation return its ID even if Cancel was clicked while it ran,
    // so the allocated multipart session can be cleaned up below.
    session = await request('/api/v1/uploads', {
      method: 'POST', body: JSON.stringify({ filename: file.name, content_type: contentType, size_bytes: file.size }),
    });
    checkCancelled();
    const partSize = session?.part_size_bytes;
    if (!session?.upload_id || !Number.isSafeInteger(partSize) || partSize < 5 * 1024 ** 2 || partSize > 100 * 1024 ** 2) {
      throw new Error('The server returned an invalid upload session.');
    }
    const base = `/api/v1/uploads/${encodeURIComponent(session.upload_id)}`;
    const parts = [];
    for (let offset = 0, number = 1; offset < file.size; offset += partSize, number++) {
      const blob = file.slice(offset, Math.min(offset + partSize, file.size));
      let etag;
      for (let attempt = 0; attempt < 3; attempt++) {
        checkCancelled();
        try {
          // Sign just before each part (including retries), avoiding expired
          // URLs on long uploads. Retrying a part replaces that same part.
          const part = await request(`${base}/parts/${number}`, { method: 'POST', signal });
          etag = await putPart(part, blob, signal, (loaded) => onProgress({ loaded: offset + loaded, total: file.size }));
          break;
        } catch (error) {
          if (error.name === 'AbortError' || attempt === 2) throw error;
          onProgress({ loaded: offset, total: file.size });
        }
      }
      parts.push({ part_number: number, etag });
      onProgress({ loaded: offset + blob.size, total: file.size });
    }
    checkCancelled();
    const result = await request(`${base}/complete`, { method: 'POST', body: JSON.stringify({ parts }), signal });
    if (!result?.source_upload_id) throw new Error('The API did not confirm the uploaded source.');
    completed = true;
    return result.source_upload_id;
  } finally {
    if (session?.upload_id && !completed) {
      // Cleanup must not use the already-cancelled signal. Server lifecycle
      // rules also need to expire sessions when a browser is closed offline.
      try { await request(`/api/v1/uploads/${encodeURIComponent(session.upload_id)}`, { method: 'DELETE' }); } catch (_) { /* Best effort. */ }
    }
  }
}
