# Cloud and data implementation checklist

No infrastructure has been provisioned by this handoff. Names below are suggested deployment labels, not existing resources. Use staging first. Choose an explicit GCP project/region and document resource sizing/budgets instead of assuming video rendering fits the smallest instance.

## Google Cloud components

| Component | Responsibility | Required configuration |
| --- | --- | --- |
| Public Cloud Run service (`shoort-clips-api`) | FastAPI JSON endpoints, OAuth callback, Creem webhook, authenticated job progress | HTTPS, exact browser CORS origins, application JWT auth, no internal router; scale and timeout suitable for short API requests/WebSockets |
| Private Cloud Run service (`shoort-clips-dispatcher`) | Cloud Tasks/Scheduler entrypoints and short dispatch/maintenance actions | Require Google IAM invocation and verify permitted caller/audience; never accessible using browser Supabase tokens |
| Cloud Run Job (`shoort-clips-worker`) | Finite Python/FFmpeg render and operation execution | Image includes ffprobe/fonts/codecs, work ID input, service identity, bounded task time/retries/concurrency, sufficient scratch memory/disk |
| Cloud Tasks queue(s) | Reliable delivery of work IDs to private dispatcher | OIDC caller, exact audience, bounded rate/retry/backoff and dispatch timeout; enqueue after durable outbox commit |
| Cloud Scheduler | Recover missed outbox/leases, expire entitlements/uploads, dispatch due publications | Invoke private maintenance routes with service identity; proposed cadence: reconcile/due scan each minute, cleanup hourly; tune cost/load |
| Artifact Registry / build pipeline | Versioned container images | Lock dependencies, reproducible build, image scanning, revision rollback |
| Secret Manager (and KMS or equivalent encryption) | Backend provider secrets and token encryption | Least-privilege access by service; separate environments; rotation and redaction |
| Cloud Logging/Monitoring | Operational evidence and alerts | Correlation IDs, stage latency, queue age, stuck jobs, render failures, R2/provider errors, quota use, webhook lag; no sensitive payloads |

Cloud Run Jobs support explicit execution and per-task limits. Configure the timeout; do not inherit a short default for a long video job. GPU jobs have different limits and require a workload sizing decision. [Job execution](https://docs.cloud.google.com/run/docs/execute/jobs), [task timeouts](https://docs.cloud.google.com/run/docs/configuring/task-timeout)

Cloud Tasks HTTP callbacks should authenticate to the private dispatcher with OIDC. The dispatcher starts the long-running execution and returns promptly; the task request must not stay open for an entire rendering pipeline. Use Google access tokens for Google APIs rather than sending a Cloud Run ID token to `run.googleapis.com`. [Cloud Tasks authentication](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)

Do not use a Python in-process thread, bare FastAPI BackgroundTasks, or a WebSocket lifetime as the durable queue for heavy rendering. [FastAPI background-task caveat](https://fastapi.tiangolo.com/tutorial/background-tasks/)

Separate service accounts: public API may read trusted auth/config and write owned metadata/outbox; dispatcher may invoke the configured jobs; worker may read/write only required data/media secrets; scheduler/task identities may invoke only private handlers. Use workload/service identity instead of downloaded long-lived GCP key files. Apply minimum permissions for job overrides and secret access rather than broad project Editor.

## R2 private storage

Create a private media bucket (or separate private sources/outputs buckets if desired) with credentials scoped to required buckets/actions. R2 is the actual video/image store; do not substitute local container paths or Supabase Storage in API responses.

Suggested immutable keys:

```text
users/{user_id}/sources/{upload_id}/source.mp4
users/{user_id}/jobs/{video_id}/transcript/v1.json
users/{user_id}/jobs/{video_id}/clips/{clip_uid}/r{revision}/video.mp4
users/{user_id}/jobs/{video_id}/clips/{clip_uid}/r{revision}/thumbnail.jpg
users/{user_id}/jobs/{video_id}/clips/{clip_uid}/r{revision}/captions.vtt
```

Use server-side boto3/S3-compatible signing for multipart operations, using the account's R2 S3 endpoint and region `auto`. A prefix is organization, not an authorization boundary: validate ownership in the API. Preserve ETag values exactly; multipart ETags are not whole-file MD5 hashes. Generate short-lived per-operation links on demand. R2 presigned links use the S3 hostname, not a public custom domain. [R2 signing](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)

CORS example for the dashboard (replace origins with the actual deployed frontend, no wildcard for private account workflows):

```json
[
  {
    "AllowedOrigins": ["https://shoortclips.com", "https://www.shoortclips.com", "http://127.0.0.1:5173"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

Remove localhost from production unless actively needed. Test browser preflight, exposed ETag, byte-range playback, thumbnails, WebVTT, and attachment downloads. Valid signatures do not replace CORS. [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

Set lifecycle rules for incomplete multipart uploads and implement database-coordinated retention for sources/artifacts. Suggested planning values (not a committed user policy): unfinished uploads 24h, unclaimed completed sources 24h; choose source/output retention explicitly before production and show expiry in the app. Never apply blanket age deletion to assets needed by active jobs/schedules. Store durable keys/hashes/byte sizes and timestamps in metadata, not expiring URLs. Private R2 objects become viewable through authorized signed URLs; the agent is not automatically granted access to every user's media.

## Supabase schema requirements (builder must create reviewed migrations)

No migration is executed by this package. Inspect the actual project's schema and signing-key configuration before writing migrations. Avoid creating a conflicting parallel user/brand schema. Use transactions for cross-table state changes and indexes beginning with owner/filter columns for account queries. Bound connection pools to the maximum API/worker instance count; choose pooled/direct connections appropriate to transaction and migration workloads.

| Table or logical entity | Key fields and constraints | Access |
| --- | --- | --- |
| Existing `auth.users` | Supabase-managed user ID | Supabase auth, never duplicate passwords |
| `user_access` | user_id PK; access type, active, trial/paid dates, provider subscription projection | Owner SELECT only; trusted server writes; no metadata-based grants |
| `access_grants` | grant_id, user_id, type, trusted issuer, validity, invitation/event source, revoked_at | Internal only; audit provenance, unique invitation use |
| `brand_profiles` | brand_id, user_id, name/channel/settings, version, created/updated; unique default per owner | Owner reads; API writes; transitional direct browser writes require owner RLS and restricted fields |
| `pilot_applications` / `rights_attestations` | verified-account linkage separate from unverified email; consent version/time/source, eligibility review | API intake; internal/owner-safe reads, no anonymous listing |
| `upload_sessions` | app upload ID, owner, R2 key/multipart ID, bytes/type, part size, state, expires_at, claimed_job_id | API/worker only; unique source claim |
| `jobs` / `job_attempts` | video_id, owner, brand/version snapshot, source reference, requested/actual count, stage/progress, immutable attempt token, lease, settings hash, errors | Owner API reads, server writes; stable owner+created indexes |
| `clips` / `clip_revisions` / `artifacts` | clip_uid, job/owner, sequence, revision, source times, post metadata, R2 keys/hash/size/type | Unique (job, clip sequence), unique immutable artifact key/revision; API signing |
| `job_events` | (video_id,event_id) unique ordered sequence, public-safe payload/time | Owner API reads; worker writes; retention policy |
| `operations` / `outbox` / `idempotency_records` | owned operation state/result, dispatched status; unique work/attempt; key+owner+route+payload hash | Internal writes; safe owner operation reads |
| `usage_reservations` / `usage_ledger` | unique job/attempt settlement, reserved/actual units, accounting period | Internal only; owner aggregates via auth/me |
| `youtube_connections` / `oauth_states` | user/channel, encrypted tokens, scopes, expiry; one-use hashed state/session binding | Internal only; profile projection through API |
| `channel_audits` / `user_analytics` / per-video metrics | owner/channel, source/evidence/sample/date range, data freshness, provider version | API writes; owner reads; no untrusted client metric overwrites |
| `clip_approvals` | user, clip_uid, exact revision, decision/actor/time | API only; history immutable |
| `schedule_settings` / `schedule_entries` / proposals | user, IANA zone/settings version, UTC slot, clip approved revision, status/version | API only; due-time and owner/date indexes; no duplicate active entry per clip revision/channel |
| `publications` | entry version, clip revision, provider upload session/ID, attempt/claim, result | Unique entry/version publication; encrypted resumable-session URI, owner-safe result reads |
| `billing_customers` / `subscriptions` / `billing_events` | unique provider bindings/event IDs, trusted user/product, event/period reconciliation | Internal only, owner-safe projection |

Composite ownership constraints must prevent cross-owner references (job→brand, clip→job, entry→clip, publication→entry). Do not rely on independently validated IDs whose ownership could later change. Database locks/unique constraints enforce source claims, reservations, default brands and publication attempts across API instances.

Enable RLS for every table exposed through Supabase Data API and grant only needed operations. Owner predicates must use trusted identity, and UPDATE policies must protect owner reassignment. Private provider tokens, signing tickets, grants, queues and billing events belong in non-exposed server-only storage. Service-role queries bypass RLS and still require explicit tenant checks. User-editable metadata is not suitable for authorization. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Existing security migration required:** root `SUPABASE_USER_ACCESS_SETUP.sql` reads `raw_user_meta_data.signup_source`, including `admin_invite`, to set active test access. That is not an authenticated invitation. Do not run it unchanged in production or merely trust rows it created. Replace the trigger/grant path, reconcile existing grants against trusted invitation/payment records, and test forged signup metadata. Root `js/supabase.js` also has a permissive metadata fallback; remove it in frontend integration. Legitimate admin-granted test accounts must be preserved based on trusted provenance.

For JWT validation, pin the intended project issuer/audience; use its JWKS only for asymmetric signing keys. Legacy HS256 user tokens need a supported server verification path. The public frontend anon key is not a user session. Document rotation/cache behavior and how strict account/session revocation is checked on expensive operations. [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)

## Provider configuration

YouTube: enable required Data/Analytics APIs, configure OAuth consent/authorized callback URI, obtain scopes separately from Supabase sign-in, and store refresh tokens encrypted. Test quota/revocation behavior. Public uploads may be restricted pending the provider project's audit. Do not advertise publishing as ready until verified for the intended privacy setting. [YouTube upload restrictions](https://developers.google.com/youtube/v3/docs/videos/insert)

YouTube source import: channel authorization does not itself provide a supported download API for audiovisual source files. Set `youtube_import=false` until the approved acquisition path is documented. Preserve direct upload as the working source flow. Do not ask the frontend user for browser cookies to work around this restriction. [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies)

Creem: create the app's intended recurring product (currently $19.96 USD/month in frontend copy), configure test mode first, fixed success URL `/payment-success.html`, and webhook `/api/v1/webhooks/creem`. Use verified raw-body signatures and durable event replay protection, not source-IP assumptions. Reconcile provider current subscription state and account mapping. A success redirect cannot activate access. [Creem webhooks](https://docs.creem.io/code/webhooks)

Transcription/clip selection: choose and report provider, region, model, retention behavior, output format, rate/cost budget and fallback. Supply API keys through Secret Manager. Do not execute AI-generated shell commands or let transcript instructions call arbitrary network/storage/publishing tools. Log timing/cost/IDs without storing private transcript text in application logs.

## Configuration names to provide (values stay server-side)

| Category | Names |
| --- | --- |
| Public/runtime | `APP_ENV`, `API_PUBLIC_URL`, `PUBLIC_APP_URL`, `CORS_ORIGINS`, `GCP_PROJECT_ID`, `GCP_REGION`, `CONTRACT_VERSION` |
| Supabase/database | `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` |
| R2 | `R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PART_SIZE_BYTES`, `R2_SIGNED_UPLOAD_TTL_SECONDS`, `R2_SIGNED_READ_TTL_SECONDS` |
| Workers | `CLOUD_RUN_WORKER_JOB`, `PRIVATE_DISPATCHER_URL`, `CLOUD_TASKS_QUEUE`, `TASK_INVOKER_SERVICE_ACCOUNT`, `ALLOWED_INTERNAL_CALLERS`, `WORKER_MAX_ATTEMPTS`, `WORKER_LEASE_SECONDS` |
| Model adapters | `STT_PROVIDER`, `STT_MODEL`, `STT_API_KEY`, `CLIP_SELECTION_PROVIDER`, `CLIP_SELECTION_MODEL`, `CLIP_SELECTION_API_KEY` (omit keys for workload-identity providers) |
| YouTube | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `YOUTUBE_CALLBACK_URL`, `OAUTH_TOKEN_ENCRYPTION_KEY_REFERENCE`, `YOUTUBE_IMPORT_ENABLED`, `YOUTUBE_PUBLISHING_ENABLED` |
| Billing | `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_MONTHLY_PRODUCT_ID`, `CREEM_TEST_MODE` |
| Guardrails | `MAX_UPLOAD_BYTES`, `MAX_SOURCE_DURATION_SECONDS`, `MAX_CLIPS_PER_JOB`, `MAX_ACTIVE_JOBS_PER_USER`, `MAX_PENDING_UPLOAD_BYTES_PER_USER`, `MONTHLY_SOURCE_SECONDS_LIMIT`, `MAX_MODEL_COST_PER_JOB`, `SOURCE_RETENTION_DAYS`, `OUTPUT_RETENTION_DAYS` |

Names are a proposed configuration interface; return a mapping if the implementation uses different names. Do not send secret values to the frontend builder. Frontend runtime needs only public base URLs, the existing Supabase public config, and capability responses.

## Deployment order

1. Review access security and data/retention policy; inventory actual DB and existing Python code.
2. Create staging identities, private R2 bucket/CORS and secrets. Build worker image and run probe/render locally on synthetic or permitted source material.
3. Create reviewed schema migrations and grants; run ownership/advisor checks and forged-metadata tests. No destructive migrations without data review/backups.
4. Deploy private dispatcher + worker, configure durable outbox/queue and recovery jobs, then deploy public API. Verify internal routes are absent from public service.
5. Configure Supabase redirects, YouTube callback/scopes, Creem test product/webhook, and approved frontend origins.
6. Run acceptance tests and fill report with actual outputs/capabilities. Keep unsupported features disabled.
7. Frontend integration and staging end-to-end checks; production activation only after remaining blockers are resolved.
