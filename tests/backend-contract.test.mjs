import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../backend-handoff/', import.meta.url);
const spec = JSON.parse(readFileSync(new URL('openapi.json', root), 'utf8'));

test('backend contract has unique operations, valid references and explicit actions', () => {
  const ids = new Set();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      assert.ok(!ids.has(operation.operationId), operation.operationId);
      ids.add(operation.operationId);
      assert.ok(operation['x-python-action'], `${method} ${path}`);
      assert.ok(operation['x-client-status']);
      const placeholders = [...path.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
      assert.deepEqual(operation.parameters.filter(p => p.in === 'path').map(p => p.name).sort(), placeholders.sort());
    }
  }
  function checkRefs(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith('#/'));
      let target = spec;
      for (const segment of value.$ref.slice(2).split('/')) target = target?.[segment];
      assert.ok(target, value.$ref);
    }
    for (const child of Object.values(value)) checkRefs(child);
  }
  checkRefs(spec);
  assert.ok(ids.size >= 50);
});

test('every current API literal/config route has a documented destination', () => {
  const frontendRoot = new URL('../', import.meta.url);
  const code = readFileSync(new URL('js/api.js', frontendRoot), 'utf8');
  const config = readFileSync(new URL('js/config.js', frontendRoot), 'utf8');
  const templates = [...code.matchAll(/request\(\s*([`'"])(\/api\/v1\/.*?)\1/g)].map(m => m[2]);
  templates.push(...[...config.matchAll(/\w+:\s*'(\/api\/v1\/[^']+)'/g)].map(m => m[1]));
  const names = { brandId: 'brand_id', videoId: 'video_id' };
  for (let path of templates) {
    path = path.replace(/\$\{query\}/g, '').split('?')[0].replace(/\$\{(\w+)\}/g, (_, name) => `{${names[name] || name}}`);
    assert.ok(spec.paths[path], `Missing route for frontend template: ${path}`);
  }
  for (const path of ['/api/v1/uploads', '/api/v1/uploads/{upload_id}/parts/{part_number}', '/api/v1/uploads/{upload_id}/complete', '/api/v1/uploads/{upload_id}']) assert.ok(spec.paths[path]);
  assert.ok(spec['x-websockets']['/api/v1/ws/jobs/{video_id}']);
});

test('auth exceptions are explicit and private actions use a separate service', () => {
  const publicOperations = new Set(['GET /healthz', 'POST /api/v1/pilot/applications', 'GET /api/v1/auth/youtube/callback', 'GET /api/v1/auth/youtube/connect']);
  for (const [path, methods] of Object.entries(spec.paths)) for (const [method, operation] of Object.entries(methods)) {
    if (operation.security?.length === 0) assert.ok(publicOperations.has(`${method.toUpperCase()} ${path}`));
    if (path.startsWith('/internal/')) {
      assert.deepEqual(operation.security, [{ GoogleOIDC: [] }]);
      assert.notEqual(operation.servers[0].url, spec.servers[0].url);
    }
  }
  assert.deepEqual(spec.paths['/api/v1/webhooks/creem'].post.security, [{ CreemSignature: [] }]);
  assert.equal(spec.paths['/api/v1/auth/youtube/connect'].get.operationId, 'reject_legacy_oauth_start');
});

test('example five-output and partial jobs report real distinct output counts', () => {
  for (const [filename, count, status] of [['job-completed-five-clips.json',5,'completed'],['job-partial-three-clips.json',3,'partial']]) {
    const { job, clips } = JSON.parse(readFileSync(new URL(`examples/${filename}`, root), 'utf8'));
    assert.equal(job.requested_clip_count, 5);
    assert.equal(job.generated_clip_count, count);
    assert.equal(clips.length, count);
    assert.equal(job.status, status);
    assert.equal(new Set(clips.map(c=>`${c.start_seconds}:${c.end_seconds}`)).size, count);
    assert.equal(new Set(clips.map(c=>c.assets.video.url)).size, count);
    if (status === 'partial') assert.ok(job.warnings.length);
  }
});
