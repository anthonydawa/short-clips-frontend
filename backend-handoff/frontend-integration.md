# Frontend integration after the API returns

The frontend is prepared for direct R2 multipart uploads and signed output media. It builds/tests in preview mode. It is **not** currently compatible with every secure protocol in the handoff, and it must remain `MOCK_MODE: true` until these changes and staging tests are complete. “Client” classifications are in `endpoint-catalog.md`.

## What already matches

- Supabase access JWTs are added to same-origin API JSON requests.
- Browser upload transport initializes multipart, signs each part just before use/retry, PUTs directly to R2 without the JWT, preserves ETags, completes/aborts, then submits only `source_upload_id`.
- Both uploaded source and YouTube-link job payloads support brand, target clip count (1–15, default five), `clean` subtitles and custom instructions.
- Job list/detail and job-level clip reads exist. Completion fetches `/jobs/{video_id}`.
- Players accept nested `assets.video|thumbnail|subtitles|download.url`, legacy R2 URL fields, refresh signed links and reject unsafe URL protocols. Thumbnails and output text have regression coverage.
- Storage health/repair, job retry/delete, brand detail/update/delete, billing status/portal and YouTube status/disconnect client helpers exist, though many lack complete UI flows.
- Preview mode communicates that processing/storage are not connected.

## Changes required before enabling the backend

### Runtime/auth/bootstrap

1. Inject one runtime config before every module entry page: public API HTTPS origin, optional WSS origin, `AUTH_ENABLED:true`, `MOCK_MODE:false`, contract version and environment. Do not bake secrets. Ensure marketing/register/app/payment pages use the same configured API origin. A fetched `/api/v1/capabilities` mismatch or disabled Phase A feature keeps generation disabled with a readable message.
2. After a verified session, call `/workspace/bootstrap`; replace synthetic `signup_{user_id}` brand IDs with canonical returned IDs. Use API brand records as the source of truth outside preview mode. Remove background direct browser writes of brand/audit/analytics duplicates to Supabase; retain localStorage only as a non-authoritative cache. Do not silently swallow API brand-save failures and claim the brand saved.
3. Remove the permissive `loadUserAccessFromSupabase` metadata fallback. Missing access state is inactive/unknown. Do not trust `signup_source` or `admin_invite` in `user_metadata` as authority. The payment page may read owner-protected access, but prefer `/billing/status` so provider/grant reconciliation is canonical.
4. Record the rights consent/version through authenticated bootstrap/attestation. Do not set `rights_confirmed:true` merely because a stale localStorage key exists. Job submission must handle `RIGHTS_ATTESTATION_REQUIRED` by showing the one-time consent UI.
5. Add a stable per-action `Idempotency-Key` to job submit, upload initialize/complete, billing checkout, approval, schedule-entry creation and other marked POSTs. Reuse it after network uncertainty; create a new key for a new intentional action. Do not automatically replay job submit after the completed upload unless the same key is reused.

### Processing and progress

6. Replace unauthenticated WebSocket connection. POST `/jobs/{video_id}/events-ticket`, open returned socket, send ticket in the first message, track `event_id`, reconnect with a new ticket/cursor, and ignore heartbeat messages. Never log ticket, JWT, socket authorization message or signed media URLs.
7. Fix socket ownership: callbacks from a stale closed socket must not set `activeSocket=null` or reconnect over a newer job. Add `if (activeSocket === socket)` guards and explicit user/session/job cancellation. Terminal states include `COMPLETED`, `FAILED`, `CANCELLED`; partial uses `stage:COMPLETED`, `status:partial` and still fetches results. Poll job detail while sockets are disabled or disconnected.
8. Render server warnings and real requested/generated counts. A five-clip request returning three must say “3 of 5” and preserve three reviewable clips. Do not display “complete” as five when status is partial.
9. Add job retry/cancel/delete controls with status-specific confirmations and outcomes. Delete is asynchronous and cannot promise that an already published external video was removed.

### Brands, audit and analytics

10. Save the canonical `Brand` returned by POST/PATCH, including version. The current client creates a timestamp ID, ignores the server response, and saves separately to Supabase. Resolve that before real jobs reference brands.
11. Channel audit now returns 202 Operation. Poll `/operations/{id}`, show true progress/failure, and apply only a completed `AuditResult`. The current modal expects an immediate brand-like object. Treat analysis output as suggestions and escape all returned display text.
12. Analytics sync also returns 202 Operation. Poll it, then fetch overview. Stop automatic fallback calls to deprecated aliases after any primary-route failure: a 401/403/validation failure must be shown, not converted into a second request. Use alias only during an explicit contract-version transition.
13. Escape provider/display values in the analytics modal (`channel_title`, handle/avatar, directives, buckets); apply `safeMediaUrl` to avatars. The current modal/audit preview interpolates API/provider text as HTML and needs hardening before live untrusted data.
14. YouTube connect becomes authenticated POST `{purpose}` returning `authorization_url`. Navigate only after validating a configured HTTPS Google authorization host or exact server response contract. Remove query `user_id` and the legacy GET call. After callback, render status/error without reading OAuth tokens from URL.

### Clip review and scheduling

15. Add Save for post title/caption/hashtags using PATCH with `expected_version`. The existing textarea edits only local DOM/copy text. Reflect returned version; tell users that post-caption edits do not modify burned subtitles.
16. Add explicit Approve/Reject and batch actions. Approval is tied to exact clip version. Display when an edit/rerender invalidates approval.
17. Add rerender controls only for supported settings, poll the render Operation and retain the prior player until new assets are ready. Do not represent changing post caption as a rerender.
18. Persist all schedule controls: frequency, test mode, approval mode, timezone, auto-fill and protect-long-form switch. Current switches only toggle CSS and are omitted from `PUT /schedule`. Preserve API version and send expected_version on subsequent saves.
19. Load real `/schedule/entries` into the calendar. `/schedule/generate` creates a proposal; accepting it explicitly creates entries. Moving/removing entries uses versioned calls. Show blocked/failed/provider-processing states.
20. Never schedule/publish draft or stale-revision clips. Auto-fill uses approved current revisions only; weekly batch remains an explicit action. Hide/disable `approved_formats` until a saved rules UI and contract extension exist. Use the authenticated channel's scope/capability status and show upload-versus-visibility delay.

### Billing/onboarding and error handling

21. Keep server pricing authoritative. Checkout uses only `plan_key`; do not unlock from URL/localStorage. Handle disabled test/live billing, webhook lag, existing active subscription and portal availability explicitly.
22. Free-trial application acknowledgment is not access approval. Show pending/approved state from trusted access. Never imply that creating an account with `signup_source=admin_invite` grants test access.
23. Render structured API `code/detail/retryable/request_id`, `Retry-After`, validation field messages, 409 stale versions, quotas and feature-disabled state. Do not turn every error into “not connected” or silently fall back to local success.
24. On sign-out, abort in-flight API/upload requests, close progress socket, clear sensitive in-memory state and signed media URLs. Use `Cache-Control:no-store` responses and do not persist transcripts or signed links in localStorage.

## Expected configuration returned by the backend builder

```html
<script>
  window.SHOORT_CLIPS_CONFIG = {
    API_BASE_URL: 'https://REAL-PUBLIC-API',
    WS_BASE_URL: 'wss://REAL-PROGRESS-ORIGIN',
    CONTRACT_VERSION: '1.0.0',
    AUTH_ENABLED: true,
    MOCK_MODE: false,
    ALLOW_LOCAL_MEDIA: false
  };
</script>
```

The values arrive through `deployment-report.template.json`; placeholders are never enabled. The frontend first checks `/healthz` for service liveness, then authenticated `/capabilities` and `/auth/me` for functional readiness/account access.

## Frontend activation test

1. Staging auth/bootstrap returns canonical brand/access.
2. Capabilities say `uploads` and `processing` true; limit values match the UI.
3. Upload a real permitted source in multiple R2 parts; ETag/CORS/progress/cancel behavior works.
4. Submit `target_clip_count:5`, reload during processing, reconnect or poll, then view exactly five distinct real MP4/thumbnail/VTT outputs.
5. Verify signed URL expiry + refresh, cross-user denial, retry/cancel/partial/failure states and post-signout cleanup.
6. Test only the Phase B capabilities reported true. Confirm no scheduling action publishes without exact approval and opt-in.
7. Build production bundle, inspect console/network/CORS, and keep a rollback version. Only now set production preview mode off.
