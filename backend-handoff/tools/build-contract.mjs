// Generates specification artifacts only. This is NOT an API server.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = (extra = {}) => ({ type: 'string', ...extra });
const id = str({ minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$' });
const text = str({ maxLength: 10000 });
const short = str({ maxLength: 255 });
const bool = { type: 'boolean' };
const integer = (minimum = 0, maximum) => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const number = (minimum = 0) => ({ type: 'number', minimum });
const dt = str({ format: 'date-time' });
const url = str({ format: 'uri', pattern: '^https?://' });
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const enumeration = (...values) => str({ enum: values });
const arr = (items, extra = {}) => ({ type: 'array', items, ...extra });
const obj = (properties, required = [], extra = {}) => ({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false, ...extra });
const schema = {};
const add = (name, properties, required = [], extra = {}) => schema[name] = obj(properties, required, extra);
const jobStatus = enumeration('queued', 'processing', 'completed', 'partial', 'failed', 'cancelling', 'cancelled');
const stages = enumeration('INGESTION', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'DIRECTING_CLIPS', 'RENDERING_CLIPS', 'COMPLETED', 'FAILED', 'CANCELLED');
const operationStatus = enumeration('queued', 'running', 'completed', 'failed', 'cancelled');
const version = integer(1);
const renderSettings = {
  subtitle_preset: enumeration('clean'), pacing_mode: enumeration('snappy', 'hyper', 'natural', 'cinematic'),
  crop_mode: enumeration('auto_track', 'center', 'left', 'right'), remove_dead_space: bool,
  enable_sfx: bool, enable_top_banner: bool,
};
add('Error', { detail: text, code: short, request_id: short, retryable: bool, field_errors: arr(obj({ field: short, message: text }, ['field', 'message'])) }, ['detail', 'code', 'request_id', 'retryable']);
add('Warning', { code: short, message: text, clip_uid: id }, ['code', 'message']);
add('Health', { status: enumeration('ok'), version: short }, ['status', 'version']);
add('Capabilities', {
  contract_version: short, storage_provider: enumeration('r2'),
  features: obj(Object.fromEntries(['uploads', 'processing', 'youtube_import', 'youtube_connect', 'analytics', 'channel_audit', 'billing', 'clip_editing', 'approvals', 'schedule', 'publishing', 'websocket_progress'].map(k => [k, bool])), ['uploads', 'processing', 'youtube_import', 'youtube_connect', 'analytics', 'channel_audit', 'billing', 'clip_editing', 'approvals', 'schedule', 'publishing', 'websocket_progress']),
  limits: obj({ max_upload_bytes: integer(1, 2147483648), max_clip_count: integer(1, 15), default_clip_count: integer(1, 15), max_source_duration_seconds: integer(1), max_concurrent_jobs_per_user: integer(1), source_retention_days: integer(1), output_retention_days: integer(1) }, ['max_upload_bytes', 'max_clip_count', 'default_clip_count', 'max_source_duration_seconds', 'max_concurrent_jobs_per_user', 'source_retention_days', 'output_retention_days']),
  disabled_reasons: { type: 'object', additionalProperties: short },
}, ['contract_version', 'storage_provider', 'features', 'limits', 'disabled_reasons']);
add('UserAccess', { user_id: str({ format: 'uuid' }), access_type: enumeration('test_user', 'free_trial', 'paid'), is_active: bool, signup_source: enumeration('direct', 'paid_signup', 'free_trial_request', 'admin_invite'), trial_ends_at: nullable(dt), paid_until: nullable(dt), subscription_status: nullable(short), reason: nullable(short), created_at: dt, updated_at: dt }, ['user_id', 'access_type', 'is_active', 'trial_ends_at', 'paid_until']);
add('Me', { user_id: str({ format: 'uuid' }), email: str({ format: 'email' }), access: ref('UserAccess'), default_brand_id: nullable(id), usage: obj({ source_seconds_used: number(), source_seconds_reserved: number(), source_seconds_limit: number(), active_jobs: integer(), period_ends_at: dt }, ['source_seconds_used', 'source_seconds_reserved', 'source_seconds_limit', 'active_jobs', 'period_ends_at']) }, ['user_id', 'email', 'access', 'default_brand_id', 'usage']);
const brandFields = { brand_name: str({ minLength: 1, maxLength: 160 }), channel_url: str({ maxLength: 2048 }), website_url: str({ maxLength: 2048 }), niche: short, target_audience: text, tone_of_voice: short, forbidden_words: text, mandatory_cta: text, hashtags: { oneOf: [text, arr(short)] }, director_system_prompt: text, is_default: bool, ...renderSettings };
add('BrandWrite', { brand_id: id, ...brandFields }, ['brand_name']);
add('BrandPatch', { ...brandFields, expected_version: version }, ['expected_version'], { minProperties: 2 });
add('Brand', { brand_id: id, user_id: str({ format: 'uuid' }), ...brandFields, version, created_at: dt, updated_at: dt, archived_at: nullable(dt) }, ['brand_id', 'brand_name', 'version', 'created_at', 'updated_at']);
add('WorkspaceBootstrap', { company: str({ minLength: 1, maxLength: 160 }), channel_url: str({ maxLength: 2048 }), timezone: str({ maxLength: 64 }), rights_confirmed: bool }, []);
add('Workspace', { user: ref('Me'), brand: ref('Brand') }, ['user', 'brand']);
add('PilotApplicationRequest', { first_name: str({ minLength: 1, maxLength: 100 }), last_name: str({ minLength: 1, maxLength: 100 }), email: str({ format: 'email', maxLength: 320 }), company: str({ minLength: 1, maxLength: 160 }), channel_url: url, consent: { oneOf: [{ const: true }, { const: 'on' }] } }, ['first_name', 'last_name', 'email', 'company', 'channel_url', 'consent']);
add('PilotApplication', { application_id: id, status: enumeration('received') }, ['application_id', 'status']);
add('UploadInit', { filename: str({ minLength: 1, maxLength: 255 }), content_type: enumeration('video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'), size_bytes: integer(1, 2147483648) }, ['filename', 'content_type', 'size_bytes']);
add('UploadSession', { upload_id: id, part_size_bytes: integer(5242880, 104857600), expires_at: dt }, ['upload_id', 'part_size_bytes', 'expires_at']);
add('UploadPartUrl', { url: str({ format: 'uri', pattern: '^https://[^/]+\\.r2\\.cloudflarestorage\\.com/' }), headers: obj({ 'Content-Type': short }), expires_at: dt }, ['url', 'headers', 'expires_at']);
add('UploadPart', { part_number: integer(1, 10000), etag: str({ minLength: 1, maxLength: 256 }) }, ['part_number', 'etag']);
add('UploadCompleteRequest', { parts: arr(ref('UploadPart'), { minItems: 1, maxItems: 10000 }) }, ['parts']);
add('UploadComplete', { source_upload_id: id, status: enumeration('completed'), size_bytes: integer(1, 2147483648) }, ['source_upload_id', 'status', 'size_bytes']);
add('UploadStatus', { upload_id: id, status: enumeration('uploading', 'completed', 'claimed', 'aborted', 'expired'), size_bytes: integer(1, 2147483648), part_size_bytes: integer(5242880, 104857600), completed_parts: arr(ref('UploadPart')), expires_at: dt }, ['upload_id', 'status', 'size_bytes', 'part_size_bytes', 'completed_parts', 'expires_at']);
add('JobSubmit', { url, source_upload_id: id, brand_id: id, target_clip_count: { ...integer(1, 15), default: 5 }, subtitle_preset: { ...enumeration('clean'), default: 'clean' }, custom_instructions: str({ maxLength: 5000 }), rights_confirmed: bool }, ['brand_id'], {
  oneOf: [{ required: ['url'], not: { required: ['source_upload_id'] } }, { required: ['source_upload_id'], not: { required: ['url'] } }],
  description: 'Exactly one source. Rights confirmation must be recorded for this account/source; omitted field is accepted only if a valid server-side attestation already exists. Link import is disabled unless an approved source provider is configured.',
});
add('Job', { video_id: id, job_slug: id, brand_id: id, status: jobStatus, stage: stages, progress: { ...number(), maximum: 100 }, message: text, requested_clip_count: integer(1, 15), generated_clip_count: integer(0, 15), source_type: enumeration('upload', 'youtube'), source_title: short, source_duration_seconds: nullable(number()), source_youtube_video_id: nullable(short), attempt: integer(1), warnings: arr(ref('Warning')), error: nullable(ref('Error')), settings: obj(renderSettings), created_at: dt, updated_at: dt, completed_at: nullable(dt) }, ['video_id', 'job_slug', 'brand_id', 'status', 'stage', 'progress', 'message', 'requested_clip_count', 'generated_clip_count', 'attempt', 'warnings', 'created_at', 'updated_at']);
add('MediaAsset', { url, expires_at: dt, content_type: short, size_bytes: integer(), width: integer(1), height: integer(1) }, ['url', 'expires_at', 'content_type']);
add('ClipAssets', { video: ref('MediaAsset'), thumbnail: ref('MediaAsset'), subtitles: ref('MediaAsset'), download: ref('MediaAsset') });
add('Clip', { clip_uid: id, clip_id: integer(1), video_id: id, brand_id: id, job_slug: id, status: enumeration('rendering', 'ready', 'approved', 'rejected', 'scheduled', 'published', 'failed'), version, generated_title: str({ maxLength: 100 }), title: short, caption: str({ maxLength: 5000 }), hashtags: arr(short), start_seconds: number(), end_seconds: number(), duration_seconds: number(), virality_score: nullable({ ...number(), maximum: 100 }), virality_reasoning: text, assets: ref('ClipAssets'), scheduled_at: nullable(dt), published_youtube_video_id: nullable(short), approved_version: nullable(version), created_at: dt, updated_at: dt }, ['clip_uid', 'clip_id', 'video_id', 'brand_id', 'status', 'version', 'generated_title', 'caption', 'hashtags', 'start_seconds', 'end_seconds', 'duration_seconds', 'assets', 'created_at', 'updated_at']);
add('JobDetail', { job: ref('Job'), clips: arr(ref('Clip'), { maxItems: 15 }) }, ['job', 'clips']);
add('JobList', { jobs: arr(ref('Job')), next_cursor: nullable(short) }, ['jobs', 'next_cursor']);
add('ClipList', { clips: arr(ref('Clip')), next_cursor: nullable(short) }, ['clips', 'next_cursor']);
add('ClipPatch', { generated_title: str({ minLength: 1, maxLength: 100 }), caption: str({ maxLength: 5000 }), hashtags: arr(short, { maxItems: 30 }), expected_version: version }, ['expected_version'], { minProperties: 2 });
add('ClipApproval', { decision: enumeration('approved', 'rejected'), expected_version: version }, ['decision', 'expected_version']);
add('BatchApproval', { clips: arr(obj({ clip_uid: id, expected_version: version }, ['clip_uid', 'expected_version']), { minItems: 1, maxItems: 100, uniqueItems: true }), decision: enumeration('approved', 'rejected') }, ['clips', 'decision']);
add('ClipRender', { expected_version: version, start_seconds: number(), end_seconds: number(), ...renderSettings }, ['expected_version'], { minProperties: 2 });
add('Operation', { operation_id: id, operation_type: enumeration('channel_audit', 'analytics_sync', 'clip_render', 'storage_sync', 'job_delete', 'publication'), status: operationStatus, progress: { ...number(), maximum: 100 }, message: text, result: nullable({ oneOf: [ref('AuditResult'), ref('AnalyticsOverview'), ref('Clip'), ref('Publication'), obj({ deleted: bool }, ['deleted']), obj({ synced_clip_count: integer() }, ['synced_clip_count'])] }), error: nullable(ref('Error')), created_at: dt, updated_at: dt }, ['operation_id', 'operation_type', 'status', 'progress', 'message', 'created_at', 'updated_at']);
add('Ticket', { ticket: str({ minLength: 32, maxLength: 512 }), expires_at: dt, websocket_url: str({ format: 'uri', pattern: '^wss://' }) }, ['ticket', 'expires_at', 'websocket_url']);
add('JobEvent', { event_id: integer(1), video_id: id, stage: stages, progress: { ...number(), maximum: 100 }, message: text, status: jobStatus, requested_clip_count: integer(1, 15), generated_clip_count: integer(0, 15), occurred_at: dt, warnings: arr(ref('Warning')) }, ['event_id', 'video_id', 'stage', 'progress', 'message', 'status', 'requested_clip_count', 'generated_clip_count', 'occurred_at']);
add('SocketAuth', { type: { const: 'authenticate' }, ticket: str({ minLength: 32, maxLength: 512 }), last_event_id: integer() }, ['type', 'ticket']);
add('StorageHealth', { provider: enumeration('r2'), configured: bool }, ['provider', 'configured']);
add('StorageSync', { status: enumeration('queued', 'completed'), operation_id: id }, ['status', 'operation_id']);
add('Evidence', { metric: short, value: nullable({ oneOf: [number(), text] }), source: short, source_video_ids: arr(short), observed_at: dt, sample_size: integer() }, ['metric', 'value', 'source', 'observed_at', 'sample_size']);
add('AuditRequest', { channel_url: url, additional_context: str({ maxLength: 5000 }) }, ['channel_url']);
add('AuditResult', { audit_id: id, brand_name: short, channel_url: url, niche: short, tone_of_voice: text, target_audience: text, mandatory_cta: text, director_system_prompt: text, data_status: enumeration('available', 'insufficient_data'), evidence: arr(ref('Evidence')), warnings: arr(ref('Warning')), analyzed_at: dt }, ['audit_id', 'brand_name', 'channel_url', 'niche', 'tone_of_voice', 'target_audience', 'mandatory_cta', 'director_system_prompt', 'data_status', 'evidence', 'warnings', 'analyzed_at']);
add('AnalyticsOverview', { total_tracked_videos: integer(), average_percent_viewed: nullable(number()), active_tests: integer(), optimal_length_bucket: nullable(short), target_duration_min_seconds: nullable(number()), target_duration_max_seconds: nullable(number()), hook_directive: text, pacing_directive: text, cta_directive: text, data_status: enumeration('not_connected', 'pending', 'available', 'insufficient_data', 'stale'), last_synced_at: nullable(dt), evidence: arr(ref('Evidence')), warnings: arr(ref('Warning')) }, ['total_tracked_videos', 'average_percent_viewed', 'active_tests', 'optimal_length_bucket', 'target_duration_min_seconds', 'target_duration_max_seconds', 'hook_directive', 'pacing_directive', 'cta_directive', 'data_status', 'last_synced_at', 'evidence', 'warnings']);
add('YouTubeConnect', { purpose: { ...enumeration('analytics', 'publishing'), default: 'analytics' } });
add('OAuthStart', { authorization_url: url, expires_at: dt }, ['authorization_url', 'expires_at']);
add('YouTubeStatus', { connected: bool, is_connected: bool, channel_id: nullable(short), channel_title: nullable(short), channel_handle: nullable(short), channel_avatar: nullable(url), subscribers: nullable(integer()), scopes: arr(short), can_publish: bool, needs_reconnect: bool }, ['connected', 'is_connected', 'channel_id', 'channel_title', 'channel_handle', 'channel_avatar', 'subscribers', 'scopes', 'can_publish', 'needs_reconnect']);
const scheduleFields = { frequency: enumeration('3', '4', '5', '7'), test_mode: enumeration('hook_angle', 'topic_mix', 'publishing_time', 'clip_length'), approval_mode: enumeration('every_clip', 'weekly_batch', 'approved_formats'), timezone: str({ minLength: 1, maxLength: 64 }), auto_fill: bool, protect_long_form_days: bool };
scheduleFields.frequency = { ...integer(3, 7), enum: [3, 4, 5, 7] };
add('ScheduleWrite', { ...scheduleFields, expected_version: version }, ['frequency', 'test_mode', 'approval_mode']);
add('Schedule', { ...scheduleFields, version, updated_at: dt }, ['frequency', 'test_mode', 'approval_mode', 'timezone', 'auto_fill', 'protect_long_form_days', 'version', 'updated_at']);
const entryFields = { clip_uid: id, expected_clip_version: version, scheduled_at: dt, timezone: str({ minLength: 1, maxLength: 64 }), privacy_status: enumeration('private', 'unlisted', 'public') };
add('ScheduleEntryWrite', entryFields, ['clip_uid', 'expected_clip_version', 'scheduled_at', 'timezone', 'privacy_status']);
add('ScheduleEntryPatch', { scheduled_at: dt, timezone: short, privacy_status: enumeration('private', 'unlisted', 'public'), expected_version: version }, ['expected_version'], { minProperties: 2 });
add('ScheduleEntry', { entry_id: id, clip_uid: id, clip_version: version, scheduled_at: dt, timezone: short, privacy_status: enumeration('private', 'unlisted', 'public'), status: enumeration('scheduled', 'dispatching', 'published', 'failed', 'cancelled', 'blocked', 'needs_reconciliation'), version, publication_id: nullable(id), error: nullable(ref('Error')), created_at: dt, updated_at: dt }, ['entry_id', 'clip_uid', 'clip_version', 'scheduled_at', 'timezone', 'privacy_status', 'status', 'version', 'created_at', 'updated_at']);
add('ScheduleEntryList', { entries: arr(ref('ScheduleEntry')), next_cursor: nullable(short) }, ['entries', 'next_cursor']);
add('ScheduleGenerate', { date_from: dt, date_to: dt, clip_uids: arr(id, { maxItems: 100 }), expected_settings_version: version }, ['date_from', 'date_to', 'expected_settings_version']);
add('ScheduleProposal', { proposal_id: id, entries: arr(ref('ScheduleEntryWrite')), warnings: arr(ref('Warning')), expires_at: dt, settings_version: version }, ['proposal_id', 'entries', 'warnings', 'expires_at', 'settings_version']);
add('Publication', { publication_id: id, entry_id: id, clip_uid: id, status: enumeration('queued', 'uploading', 'published', 'failed', 'needs_reconciliation'), youtube_video_id: nullable(short), youtube_url: nullable(url), error: nullable(ref('Error')), created_at: dt, updated_at: dt }, ['publication_id', 'entry_id', 'clip_uid', 'status', 'youtube_video_id', 'youtube_url', 'created_at', 'updated_at']);
add('BillingCheckout', { plan_key: { const: 'shoort_monthly' } }, ['plan_key']);
add('CheckoutResult', { configured: { const: true }, checkout_url: url, checkout_id: id }, ['configured', 'checkout_url', 'checkout_id']);
add('PortalResult', { portal_url: url }, ['portal_url']);
add('BillingStatus', { configured: bool, status: short, access: ref('UserAccess') }, ['configured', 'status', 'access']);
add('WebhookReceipt', { received: { const: true } }, ['received']);
add('CreemEvent', { id, eventType: short, created_at: integer(), object: { type: 'object', additionalProperties: true } }, ['id', 'eventType', 'created_at', 'object'], { additionalProperties: true });
add('InternalDispatch', { work_id: id, work_type: enumeration('video_job', 'operation', 'publication', 'webhook_event') }, ['work_id', 'work_type']);
add('MaintenanceRequest', { batch_size: { ...integer(1, 1000), default: 100 } });
add('MaintenanceResult', { examined: integer(), dispatched: integer(), failed: integer() }, ['examined', 'dispatched', 'failed']);

const spec = {
  openapi: '3.1.0', info: { title: 'Shoort Clips Python API implementation contract', version: '1.0.0', description: 'Specification only; no endpoints are deployed. README.md, python-functions.md and cloud-setup.md define required side effects/security. x-client-status distinguishes current calls from future wiring. Internal operations are served only on a separate IAM-protected service.' },
  servers: [{ url: 'https://api.shoortclips.invalid', description: 'Placeholder. Replace with returned public HTTPS API origin.' }],
  security: [{ SupabaseBearer: [] }], paths: {},
  components: { securitySchemes: {
    SupabaseBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'Supabase user access JWT' },
    GoogleOIDC: { type: 'http', scheme: 'bearer', bearerFormat: 'Google service-account ID token with exact audience; verify allowed service identity' },
    CreemSignature: { type: 'apiKey', in: 'header', name: 'creem-signature', description: 'HMAC-SHA256 over raw request bytes. Not a Supabase token.' },
  }, schemas: schema },
  'x-websockets': { '/api/v1/ws/jobs/{video_id}': { description: 'One-use ticket via authenticated HTTP route, then first-message auth within 5 seconds. No query-string JWTs. See README durable progress protocol.', client_status: 'change-required', client_message_schema: ref('SocketAuth'), server_event_schema: ref('JobEvent'), close_codes: { '4401': 'Missing/expired ticket or session', '4403': 'Origin or resource denied', '4408': 'Authentication timeout' } } },
};
const response = (name, description = 'Success') => ({ description, content: { 'application/json': { schema: typeof name === 'string' ? ref(name) : name } } });
const qp = (name, s = short, required = false, description = '') => ({ name, in: 'query', required, schema: s, description });
const pagination = [qp('limit', { ...integer(1, 100), default: 50 }), qp('cursor')];
function route(method, path, operationId, summary, result, { body, status = '200', parameters = [], publicRoute = false, auth, client = 'new', phase = 'A', action, description = '', idempotent = false, extraResponses = {}, deprecated = false, internal = false } = {}) {
  const p = [...path.matchAll(/\{([^}]+)\}/g)].map(([,name]) => ({ name, in: 'path', required: true, schema: name === 'part_number' ? integer(1, 10000) : id }));
  if (idempotent) parameters = [...parameters, { name: 'Idempotency-Key', in: 'header', required: false, schema: str({ format: 'uuid' }), description: 'Required in production client integration for expensive/stateful POSTs; optional only for current-client transition. Same key + changed payload returns 409.' }];
  const errors = Object.fromEntries(['400','401','403','404','409','422','429','503'].map(code => [code, response('Error', ({'400':'Bad request','401':'Authentication required','403':'Access denied','404':'Resource not found or not owned','409':'Conflict','422':'Validation/unsupported feature input','429':'Quota/rate limited','503':'Provider/feature unavailable'})[code])]));
  if (publicRoute) delete errors['401'];
  const operation = { operationId, summary, tags: [internal ? 'Internal' : path.split('/')[3] || 'Health'], description, 'x-phase': phase, 'x-client-status': client, 'x-python-action': action || operationId, parameters: [...p,...parameters], responses: { ...errors, [status]: result ? response(result) : { description: 'No content' }, ...extraResponses } };
  if (body) operation.requestBody = { required: true, content: { 'application/json': { schema: ref(body) } } };
  if (publicRoute) operation.security = [];
  if (auth) operation.security = [{ [auth]: [] }];
  if (deprecated) operation.deprecated = true;
  if (internal) operation.servers = [{ url: 'https://internal.shoortclips.invalid', description: 'Separate IAM-protected Cloud Run service. Never expose this router on the public service.' }];
  (spec.paths[path] ||= {})[method] = operation;
}
route('get','/healthz','health','Public liveness (no dependency details)','Health',{publicRoute:true});
route('get','/api/v1/capabilities','get_capabilities','Read configured features and hard limits','Capabilities');
route('get','/api/v1/auth/me','get_me','Verified identity, entitlement and quota usage','Me',{client:'client-only'});
route('post','/api/v1/workspace/bootstrap','bootstrap_workspace','Idempotently create/load the verified user workspace','Workspace',{body:'WorkspaceBootstrap',idempotent:true,description:'Derive identity from JWT; display metadata may seed names but never grants access. Return canonical owned brand, never an unchecked signup_* alias.'});
route('post','/api/v1/pilot/applications','create_pilot_application','Record trial request; does not grant access','PilotApplication',{body:'PilotApplicationRequest',status:'201',publicRoute:true,client:'called',phase:'B1',idempotent:true,description:'Public intake supports signup pending email confirmation. Rate limit and generic acknowledgment; never associate/grant authority based only on supplied email or signup_source. Do not receive passwords.'});
route('get','/api/v1/brands','list_brands','List owned brands',arr(ref('Brand')),{parameters:[qp('limit',{...integer(1,100),default:50})],client:'client-only'});
route('post','/api/v1/brands','create_brand','Create owned brand or update same-owner legacy ID','Brand',{body:'BrandWrite',status:'200',client:'called',idempotent:true,description:'Compatibility: client currently POSTs saves with brand_<timestamp>. Upsert only if owner matches; conflict for an ID owned elsewhere. Omitted ID gets server ID. New frontend uses returned canonical ID/PATCH versioning. Never trust nested raw_profile_json as authorization.'});
route('get','/api/v1/brands/{brand_id}','get_brand','Read owned brand','Brand',{client:'client-only'});
route('patch','/api/v1/brands/{brand_id}','update_brand','Update brand with optimistic concurrency','Brand',{body:'BrandPatch',client:'change-required'});
route('delete','/api/v1/brands/{brand_id}','delete_brand','Delete empty owned brand',null,{status:'204',client:'client-only',description:'409 if referenced by jobs/publications; never silently cascade media deletion.'});
route('post','/api/v1/uploads','initialize_upload','Create owned R2 multipart source upload','UploadSession',{body:'UploadInit',status:'201',client:'called',idempotent:true});
route('get','/api/v1/uploads/{upload_id}','get_upload','Inspect owned upload and completed part manifest','UploadStatus');
route('post','/api/v1/uploads/{upload_id}/parts/{part_number}','sign_upload_part','Sign exactly one owned R2 upload part','UploadPartUrl',{client:'called'});
route('post','/api/v1/uploads/{upload_id}/complete','complete_upload','Finalize and verify R2 object before accepting source','UploadComplete',{body:'UploadCompleteRequest',client:'called',idempotent:true});
route('delete','/api/v1/uploads/{upload_id}','abort_upload','Abort unclaimed incomplete source upload',null,{status:'204',client:'called',description:'Idempotent. Never delete a source claimed by a job. Completed/unclaimed object cleanup follows retention policy.'});
route('post','/api/v1/jobs/submit','submit_job','Persist source job and enqueue real video generation','Job',{body:'JobSubmit',status:'202',client:'called',idempotent:true,description:'Exactly one source; target_clip_count is actual distinct output count (default 5). Atomic job/quota/upload claim/outbox; no rendering in HTTP request. Provider-disabled YouTube import returns 422 SOURCE_UPLOAD_REQUIRED.'});
route('get','/api/v1/jobs','list_jobs','List all owned jobs newest first','JobList',{parameters:[qp('brand_id',id),...pagination],client:'called'});
route('get','/api/v1/jobs/{video_id}','get_job','Read durable progress and freshly signed clip assets','JobDetail',{client:'called'});
route('get','/api/v1/jobs/{video_id}/clips','list_job_clips','List owned job clips',arr(ref('Clip')),{client:'client-only'});
route('post','/api/v1/jobs/{video_id}/retry','retry_job','Retry failed stages/missing outputs without duplication','Job',{status:'202',client:'client-only',idempotent:true});
route('post','/api/v1/jobs/{video_id}/cancel','cancel_job','Request cooperative cancellation','Job',{status:'202',idempotent:true,description:'Cancel queued work or set durable cancellation flag. Stop worker at safe checkpoints, preserve usable partial artifacts, release unused reservations; never just close WebSocket.'});
route('delete','/api/v1/jobs/{video_id}','delete_job','Queue owned job and artifact cleanup','Operation',{status:'202',client:'client-only',description:'409 while running or tied to active publication; cancellation is separate. Does not remove already-published YouTube videos.'});
route('post','/api/v1/jobs/{video_id}/events-ticket','issue_events_ticket','Issue one-use scoped WebSocket ticket','Ticket',{client:'new',description:'Do not release job events until ticket is consumed in the first socket message. Tickets expire after 60s; socket authorization ends at auth session expiry.'});
route('get','/api/v1/clips','list_clips','Paginated library across all owned jobs','ClipList',{parameters:[qp('brand_id',id),qp('status',short),...pagination]});
route('get','/api/v1/clips/{clip_uid}','get_clip','Read owned clip with fresh media URLs','Clip');
route('patch','/api/v1/clips/{clip_uid}','update_clip','Save post title/caption/hashtags; invalidate stale approval','Clip',{body:'ClipPatch',phase:'B3'});
route('post','/api/v1/clips/{clip_uid}/approval','approve_clip','Approve/reject the exact clip revision','Clip',{body:'ClipApproval',phase:'B3',idempotent:true});
route('post','/api/v1/clips/approvals','approve_clip_batch','Atomically approve/reject a named batch',arr(ref('Clip')),{body:'BatchApproval',phase:'B3',idempotent:true});
route('post','/api/v1/clips/{clip_uid}/render','render_clip_revision','Queue changed timing/crop/caption styling render','Operation',{body:'ClipRender',phase:'B3',status:'202',idempotent:true,description:'Validate end > start, source bounds, supported settings. Generate immutable revision assets; keep prior playable output until atomic replacement. Approval resets; active publication blocks edit.'});
route('get','/api/v1/storage/health','get_storage_health','Report R2 readiness without credentials','StorageHealth',{client:'client-only'});
route('post','/api/v1/storage/sync/{video_id}','repair_job_storage','Queue missing output storage repair','StorageSync',{status:'202',client:'called',idempotent:true,description:'Normal processing already persists output. Repair must not claim success from local ephemeral files that no longer exist.'});
route('get','/api/v1/operations/{operation_id}','get_operation','Poll owned audit/sync/render/publication operation','Operation');
route('post','/api/v1/brands/analyze-channel','start_channel_audit','Queue evidence-backed channel audit','Operation',{body:'AuditRequest',status:'202',client:'change-required',phase:'B2',idempotent:true,description:'Existing modal expects synchronous result; update it to poll operation and read result. Do not fake immediate audit content. User channel/context text is untrusted data.'});
route('get','/api/v1/analytics/overview','get_analytics','Read saved authorized channel metrics/directives','AnalyticsOverview',{phase:'B2',client:'called'});
route('post','/api/v1/analytics/sync','start_analytics_sync','Queue real channel metric collection','Operation',{status:'202',phase:'B2',client:'change-required',idempotent:true});
route('get','/api/v1/auth/youtube/analytics','get_analytics_legacy','Compatibility alias for analytics overview','AnalyticsOverview',{phase:'B2',client:'legacy',deprecated:true,action:'get_analytics'});
route('post','/api/v1/auth/youtube/sync','start_analytics_sync_legacy','Compatibility alias sharing sync deduplication','Operation',{status:'202',phase:'B2',client:'legacy',deprecated:true,idempotent:true,action:'start_analytics_sync'});
route('post','/api/v1/auth/youtube/connect','start_youtube_oauth','Create user-bound OAuth consent URL','OAuthStart',{body:'YouTubeConnect',phase:'B2',client:'change-required',description:'Authenticated POST. Server-generated state/PKCE and exact redirect URI. Store pending user binding, expiry and one-use state; OAuth does not rely on query user_id.'});
route('get','/api/v1/auth/youtube/connect','reject_legacy_oauth_start','Reject insecure user_id-based OAuth start','Error',{status:'400',phase:'B2',publicRoute:true,client:'legacy-reject',deprecated:true,description:'Do not implement authorization from ?user_id=. Return OAUTH_POST_REQUIRED; frontend must use authenticated POST then navigate to authorization_url.'});
route('get','/api/v1/auth/youtube/callback','finish_youtube_oauth','Validate state, exchange code and bind owned channel',null,{status:'303',phase:'B2',publicRoute:true,parameters:[qp('state',short,true),qp('code',text),qp('error',short)],extraResponses:{'303':{description:'Redirect to allowlisted app page with success/error marker, never tokens.',headers:{Location:{required:true,schema:url}}}},description:'Require a pending unexpired one-use state and exactly code or error. Verify chosen channel using OAuth identity, encrypt refresh token, ensure scopes and provider state. Failure cannot attach a channel.'});
route('get','/api/v1/auth/youtube/status','get_youtube_status','Read channel connection/scopes','YouTubeStatus',{phase:'B2',client:'called'});
route('delete','/api/v1/auth/youtube/disconnect','disconnect_youtube','Revoke/remove tokens and block pending publishing',null,{status:'204',phase:'B2',client:'called'});
route('get','/api/v1/schedule','get_schedule','Read account schedule preferences','Schedule',{phase:'B3'});
route('put','/api/v1/schedule','save_schedule','Save preferences only; no implicit publication','Schedule',{body:'ScheduleWrite',phase:'B3',client:'change-required',description:'Current client sends only frequency/test_mode/approval_mode. Preserve omitted switches/timezone. Defaults UTC,false,false on first creation. Require expected_version on subsequent updates. approved_formats returns 422 until a saved explicit rule system is implemented.'});
route('post','/api/v1/schedule/generate','propose_schedule','Propose slots for approved clips; does not persist/publish','ScheduleProposal',{body:'ScheduleGenerate',phase:'B3',description:'Return proposal with warnings. User explicitly creates entries to accept it. Revalidate clip revision, timezone and collisions on entry creation.'});
route('get','/api/v1/schedule/entries','list_schedule_entries','Read calendar entries in requested date range','ScheduleEntryList',{phase:'B3',parameters:[qp('date_from',dt,true),qp('date_to',dt,true),...pagination]});
route('post','/api/v1/schedule/entries','create_schedule_entry','Explicitly schedule an approved clip revision','ScheduleEntry',{body:'ScheduleEntryWrite',status:'201',phase:'B3',idempotent:true});
route('patch','/api/v1/schedule/entries/{entry_id}','update_schedule_entry','Move/change a not-yet-dispatched schedule entry','ScheduleEntry',{body:'ScheduleEntryPatch',phase:'B3',description:'409 if already dispatching/published, stale version, missing approval, or safety constraints violated.'});
route('delete','/api/v1/schedule/entries/{entry_id}','cancel_schedule_entry','Cancel a not-yet-dispatched schedule entry',null,{status:'204',phase:'B3',description:'Idempotent. 409 for dispatching/published; never claim an already uploaded/published clip was recalled.'});
route('get','/api/v1/publications/{publication_id}','get_publication','Read publication outcome/reconciliation state','Publication',{phase:'B3'});
route('post','/api/v1/billing/checkout','create_checkout','Create server-priced Creem checkout','CheckoutResult',{body:'BillingCheckout',phase:'B1',client:'called',idempotent:true,description:'Authenticate but do not require active paid entitlement; check verified account email. Product ID, price, success URL and metadata owner come from server.'});
route('get','/api/v1/billing/status','get_billing_status','Read trusted subscription and access state','BillingStatus',{phase:'B1',client:'client-only'});
route('post','/api/v1/billing/portal','create_billing_portal','Create portal link for verified customer binding','PortalResult',{phase:'B1',client:'client-only'});
route('post','/api/v1/webhooks/creem','receive_creem_webhook','Verify raw signature and durably accept billing event','WebhookReceipt',{body:'CreemEvent',phase:'B1',auth:'CreemSignature',description:'Read raw bytes before parsing; verify HMAC in constant time, persist provider/event unique ID, then process durably. No access grant from success redirect. Unknown event types may be recorded/acknowledged without mutation.'});
for(const [path, operationId, summary, body] of [
  ['/internal/v1/dispatch','dispatch_work','Start durable worker execution from owned work row','InternalDispatch'],
  ['/internal/v1/maintenance/reconcile','reconcile_work','Recover outbox, stale leases and provider uncertainty','MaintenanceRequest'],
  ['/internal/v1/maintenance/cleanup','cleanup_expired_resources','Clean expired orphan uploads/assets according to retention','MaintenanceRequest'],
  ['/internal/v1/publishing/dispatch-due','dispatch_due_publications','Claim due approved entries and enqueue publication work','MaintenanceRequest'],
]) route('post',path,operationId,summary,'MaintenanceResult',{body,auth:'GoogleOIDC',internal:true,phase:path.includes('publishing')?'B3':'A',description:'Separate private Cloud Run service. Verify allowed service-account identity and exact audience; reject browser/Supabase JWTs. Operates on server-owned work rows, no arbitrary URLs/commands. Dispatch returns after durable handoff, never after a whole render.'});

const examples = {};
const at = '2026-08-31T08:00:00Z';
const jobExample = { video_id:'vid_example',job_slug:'customer-interview',brand_id:'brand_example',status:'queued',stage:'INGESTION',progress:0,message:'Source accepted; queued for processing.',requested_clip_count:5,generated_clip_count:0,attempt:1,warnings:[],created_at:at,updated_at:at };
examples['submit-five-clips.json'] = { schema:'JobSubmit', value:{source_upload_id:'upl_example',brand_id:'brand_example',target_clip_count:5,subtitle_preset:'clean',custom_instructions:'Prioritize practical lessons.'} };
examples['job-accepted.json'] = { schema:'Job', value:jobExample };
const clipExample = (n) => ({ clip_uid:`clip_example_${n}`,clip_id:n,video_id:'vid_example',brand_id:'brand_example',job_slug:'customer-interview',status:'ready',version:1,generated_title:`Useful moment ${n}`,caption:'A concise post caption.',hashtags:['#Learning'],start_seconds:(n-1)*45,end_seconds:(n-1)*45+30,duration_seconds:30,virality_score:null,virality_reasoning:'Selected as a complete useful explanation; not a measured performance prediction.',assets:Object.fromEntries([['video','mp4','video/mp4'],['thumbnail','jpg','image/jpeg'],['subtitles','vtt','text/vtt'],['download','mp4','video/mp4']].map(([kind,ext,type])=>[kind,{url:`https://account.r2.cloudflarestorage.com/example/clip-${n}.${ext}?example=not-a-real-signature&kind=${kind}`,expires_at:'2026-08-31T08:15:00Z',content_type:type}])),created_at:at,updated_at:at });
examples['job-completed-five-clips.json'] = { schema:'JobDetail', value:{job:{...jobExample,status:'completed',stage:'COMPLETED',progress:100,message:'Five clips ready.',generated_clip_count:5,completed_at:at},clips:Array.from({length:5},(_,i)=>clipExample(i+1))} };
examples['job-partial-three-clips.json'] = { schema:'JobDetail', value:{job:{...jobExample,status:'partial',stage:'COMPLETED',progress:100,message:'Only three valid distinct moments found.',generated_clip_count:3,warnings:[{code:'INSUFFICIENT_DISTINCT_MOMENTS',message:'Three clips available; five requested.'}],completed_at:at},clips:Array.from({length:3},(_,i)=>clipExample(i+1))} };
examples['progress-event.json'] = { schema:'JobEvent', value:{event_id:8,video_id:'vid_example',stage:'RENDERING_CLIPS',progress:75,message:'Rendered 3 of 5 clips.',status:'processing',requested_clip_count:5,generated_clip_count:3,occurred_at:at} };
examples['analytics-empty.json'] = { schema:'AnalyticsOverview', value:{total_tracked_videos:0,average_percent_viewed:null,active_tests:0,optimal_length_bucket:null,target_duration_min_seconds:null,target_duration_max_seconds:null,hook_directive:'',pacing_directive:'',cta_directive:'',data_status:'not_connected',last_synced_at:null,evidence:[],warnings:[]} };
examples['error.json'] = { schema:'Error', value:{detail:'Upload the source video file to process this video.',code:'SOURCE_UPLOAD_REQUIRED',request_id:'req_example',retryable:false} };
for(const [filename,item] of Object.entries(examples)) {
  (schema[item.schema].examples ||= []).push(item.value);
  await mkdir(new URL('examples/',root),{recursive:true});
  await writeFile(new URL(`examples/${filename}`,root),JSON.stringify(item.value,null,2)+'\n');
}
await writeFile(new URL('examples/manifest.json',root),JSON.stringify(Object.fromEntries(Object.entries(examples).map(([file,item])=>[file,item.schema])),null,2)+'\n');
await writeFile(new URL('openapi.json',root),JSON.stringify(spec,null,2)+'\n');
const operations = Object.entries(spec.paths).flatMap(([path, methods])=>Object.entries(methods).map(([method,op])=>({path,method,op})));
await writeFile(new URL('endpoint-catalog.md',root),`# Endpoint catalog\n\nGenerated from openapi.json; ${operations.length} HTTP operations plus one WebSocket route. No routes are deployed.\n\nClient status: **called** = currently invoked; **client-only** = helper exists but no complete UI flow; **change-required** = current call needs protocol/payload changes; **new** = future wiring; **legacy** = compatibility alias; **legacy-reject** = intentionally reject insecure old call.\n\n| Method | Path | Phase | Client | Python action | Purpose |\n| --- | --- | --- | --- | --- | --- |\n${operations.map(({path,method,op})=>`| ${method.toUpperCase()} | \`${path}\` | ${op['x-phase']} | ${op['x-client-status']} | \`${op['x-python-action']}\` | ${op.summary} |`).join('\n')}\n\nWebSocket: \`/api/v1/ws/jobs/{video_id}\`, Phase A; authenticated one-use first-message ticket. See README.md.\n`);
console.log(`Wrote ${operations.length} HTTP operations, ${Object.keys(schema).length} schemas and ${Object.keys(examples).length} payload examples to ${fileURLToPath(root)}`);
