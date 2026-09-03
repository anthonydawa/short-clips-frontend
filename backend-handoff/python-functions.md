# Python services and worker actions

This is a function-level implementation request, not Python runtime code. HTTP handler names and their mapping appear in `endpoint-catalog.md` (`x-python-action` in OpenAPI). Every handler must call implemented services below. A route that just returns a plausible response without the specified durable action fails acceptance.

## Suggested project structure

```text
app/
  main.py                     # Public FastAPI application, no internal router
  internal_main.py            # Separate IAM-protected dispatcher/maintenance app
  api/                        # auth, brands, uploads, jobs, clips, analytics,
                              # youtube, schedule, billing, operations
  models/                     # Typed request/response and durable state models
  repositories/               # Ownership-scoped SQL and transactions
  services/                   # Functions below, provider adapters
  workers/video_pipeline.py   # Cloud Run Job entry point
  workers/operations.py       # audit, analytics, rerender, repair, deletion
  workers/publishing.py       # resumable upload + reconciliation
  security/                   # JWT, OAuth state, signature, SSRF, quotas
tests/
migrations/
Dockerfile.api
Dockerfile.worker
```

Use supported, pinned Python/FastAPI/Pydantic/provider library versions and lock dependencies. Reuse existing rendering code if the user supplies it; wrap it with durable job/state/storage interfaces instead of exposing its filesystem. Model/STT providers are configured adapters, not assumptions about a specific vendor/model. FFmpeg/ffprobe and required fonts/codecs must be included and verified in the worker image.

## Identity, onboarding and brands

| Function | Inputs → output | Required action |
| --- | --- | --- |
| `verify_user_access_token` | bearer JWT → verified identity/session | Validate configured issuer, audience, allowed signing algorithms, signature, expiry and subject; never decode-only. Handle signing-key rotation. Reject anon/project API keys as user identity. Use provider verification for legacy shared-secret tokens rather than assuming JWKS contains their keys. |
| `get_entitlement` | verified user → UserAccess + quota | Read trusted server state, enforce trial expiry/paid-through date, suspension and missing-row denial. Unknown state is not test access. |
| `authorize_resource` | user, resource kind/ID → owned row | Ownership checks for uploads, brands, jobs, clips, operations, schedule and publications; query by owner + ID. Service-role access does not substitute for ownership. |
| `bootstrap_workspace` | identity, display profile → Workspace | Idempotently load/create canonical default brand; seed only display fields from verified account/profile inputs. Save rights attestation with timestamp/version. Do not grant access from signup metadata. |
| `record_pilot_application` | public intake → application acknowledgment | Validate lengths/consent, throttle abuse, store unverified request, generic response. Match to a verified account later without email-based account takeover. |
| `grant_trial` / `grant_test_access` | authenticated admin procedure or trusted invitation → grant | Internal administrative functions, not public browser endpoints. Record actor, reason, account, validity period and unique invitation use. Enforce at most one approved trial per eligibility policy. |
| `save_brand` | owner, validated brand fields/version → Brand | Own user_id, canonical brand_id, immutable timestamps, validated settings. Maintain one default per user. Same-owner legacy POST upsert is transitional; reject collisions with other users. |
| `snapshot_job_strategy` | owned brand, instructions, analytics snapshot → immutable settings | Snapshot brand version, prompt-template version, available evidence and bounded editing settings at submission. Later brand edits cannot mutate an in-flight job. Model prompts cannot grant publishing permission or alter authorization. |

New account activation and billing/grant reconciliation must write the same trusted entitlement source the API checks. Reads of a copied `user_access` row alone are insufficient if it was populated by the existing unsafe signup trigger: reconcile its provenance before launch.

## Uploads, quota and durable dispatch

| Function | Required behavior |
| --- | --- |
| `initialize_upload` | Check identity/entitlement, file type/size limits and pending-upload quota. Generate non-user-controlled key `users/{uid}/sources/{upload_id}/source.ext`, initiate R2 multipart, save upload state, and return application upload ID plus part size (16 MiB suggested). Compensate/clean up an R2 session if database persistence fails. No bucket keys in the frontend. |
| `sign_upload_part` | Check owner, non-expired/non-aborted state and expected part count from byte size; sign only the exact key, multipart ID and part number. Return short-lived HTTPS R2 UploadPart URL, expiry and the optional signed Content-Type header. Never sign an arbitrary URL/key supplied by a client. |
| `complete_upload` | Lock session; validate ordered unique part numbers, expected count and exact ETags against R2 ListParts; complete; HEAD final object and verify actual bytes/content type/metadata. Persist completed source atomically/idempotently. Recover ambiguous network results by inspecting storage, not blindly marking failed/successful. A MIME header is not proof of valid video. |
| `abort_upload` | Abort only the owned incomplete upload; repeated requests succeed. Never remove a claimed processing source. Expiry/cleanup policy covers disconnected browsers and unclaimed completed sources. |
| `reserve_usage` / `settle_usage` | Atomic quota reservation and actual-usage settlement; enforce concurrent jobs and source-duration/model-cost budgets. Where duration is unknown before probe, reserve a bounded amount or preliminary slot, then validate/reserve duration before expensive work. Release unused reservation on every terminal/error/cancel path; do not debit twice on retry. |
| `submit_job` | Validate exactly one source, entitlement, canonical owned brand, source rights attestation, and settings. In one transaction claim completed upload, snapshot settings, reserve usage, insert queued job and dispatch outbox. Return Job with 202 only after durable commit. Never run FFmpeg in the HTTP request. |
| `dispatch_work` | Cloud Tasks calls the private dispatcher with a work-row ID. Verify Google service identity, read durable work row, and start a Cloud Run Job with the work ID as trusted configuration. Return promptly after handoff. If start result is uncertain, reconcile execution before relaunch. An execution duplicate still cannot claim an already-active fenced worker lease. |
| `claim_work` / `heartbeat_lease` | Worker atomically claims a pending attempt with a lease/fencing token, records execution ID, and periodically heartbeats. Every stage/artifact write verifies the attempt token. Stale workers cannot overwrite newer attempts. |
| `append_job_event` | Transactionally persist status/progress/event sequence with stage state. Readers and WebSockets work across API instances/restarts. Redact sensitive data from user-facing errors and diagnostic logs. |
| `reconcile_work` | Scan bounded batches of undispatched outbox, stalled attempts, missing worker executions and unsettled reservations. Requeue with bounded backoff, mark terminal after attempt limits, emit actionable failure, and alert. Dead-letter state requires operator visibility. |

Idempotency records bind owner + route + key to the normalized request hash and result. Retain through operation lifetime and at least 24 hours afterward. Source-upload claims also prevent duplicate jobs from repeated submit calls. A job retry uses the same product job ID with a new attempt and checkpoint plan; it does not create duplicate successful clips.

## `run_video_pipeline(video_id, attempt_token)`

1. **`load_job_context`**: load immutable strategy/source reference and current ownership/entitlement. Check cancellation before expensive work. Get secrets/provider clients via service identity. Select isolated temporary directory with memory/disk budgeting; input file size does not bound decoded intermediates.
2. **`resolve_source`**: stream the verified owned source object from R2 to the worker. The optional YouTube adapter accepts only supported authorized source acquisition. If no approved importer exists, reject link ingestion with `SOURCE_UPLOAD_REQUIRED`; do not embed arbitrary downloader/cookie scraping as a hidden implementation assumption.
3. **`probe_media`**: use ffprobe, verify video/audio streams, codecs, duration, resolution and quotas. Reject corrupt/empty/excessive media. Use generated local filenames, argument arrays and `shell=False`; do not interpolate user input into commands. Bound CPU, memory, decode time and all subprocess lifetimes. Emit `INGESTION` only after a usable source exists.
4. **`extract_audio`**: normalize working audio for the configured transcription adapter; persist recoverable checkpoint metadata. Emit `EXTRACTING_AUDIO`.
5. **`transcribe_source`**: obtain timestamped segments/words with language and confidence; preserve source offsets. Handle no speech/low confidence explicitly. Cache by source hash + provider/model/config version so retries do not repay transcription unnecessarily. Emit `TRANSCRIBING`.
6. **`select_clip_candidates`**: use transcript/context/evidence to propose more candidates than requested, with source start/end, title, rationale and scores labeled as heuristic. Treat transcripts, channel metadata and custom instructions as untrusted content, not tool instructions. Validate model JSON and bounded output count. Emit `DIRECTING_CLIPS`.
7. **`validate_and_rank_candidates`**: require finite times, `0 <= start < end <= duration`, enough intelligible content, coherent boundaries, bounded overlap and distinct passages. Reject duplicate intervals or near-identical clips. Use configured duration targets; analytics may suggest targets but must not fabricate evidence. Select up to requested count and record shortfall reason.
8. **`build_edit_plan`**: decide crop/tracking, pacing/dead-space edits, clean subtitle style, allowed CTA overlays and licensed optional sound effects from snapshotted settings. Maintain a time mapping from source words to edited output for captions. If auto tracking has insufficient confidence, use a documented center-crop fallback with warning. Unsupported requested effects fail validation; never silently enable placeholders.
9. **`render_clip`**: render each selected plan to vertical 1080×1920 (or a clearly documented resource-constrained preset) H.264/AAC MP4, yuv420p, web fast-start. Use bounded parallelism. Generate unique immutable revision files; do not reuse the same video as multiple clips. Emit `RENDERING_CLIPS`, with per-clip counts and monotonic overall progress.
10. **`write_caption_assets` / `make_thumbnail`**: generate synchronized WebVTT for browser track and a JPEG/PNG thumbnail from the actual output. Clean subtitles must avoid unreadable placement and excessive line length. Distinguish spoken captions from the post caption/hashtags. Do not burn and display a duplicate subtitle layer by default; document whether tracks start enabled for each rendered preset.
11. **`validate_rendered_assets`**: ffprobe/read representative frames/audio, verify nonzero duration, 9:16 ratio, browser-compatible tracks, intelligibility and caption ranges within output duration. Re-render failed candidates or select replacements within the bounded attempt budget. Do not mark ready on file existence alone.
12. **`persist_clip_assets`**: upload verified MP4, thumbnail and VTT to private R2 under owner/job/clip/revision prefix. HEAD/verify size, content type and checksums/manifest. Commit durable artifact keys and ready Clip records after persistence. Keep previous revision available until replacement succeeds. Immutable keys prevent signed URL/cache confusion.
13. **`finalize_job`**: reconcile real usable count against request. Completed means all requested outputs exist; partial means some usable clips with explicit shortfall/failures; failed means none. Settle quota, commit terminal state and final counts, then emit terminal event. Ensure a subsequent GET returns all artifacts referenced by that event.
14. **`cleanup_workdir`**: terminate child processes and remove only the verified per-attempt temp directory in `finally`. Durable intermediate retention/cleanup is a separate policy; a container filesystem is never the asset source of truth.

Cancel cooperatively between stages/clip renders and interrupt subprocesses safely. Preserve already committed outputs, release unused reservations, and emit cancelled terminal state. A partial retry must retain original clip IDs/revisions for outputs that are already valid.

## Media, edits and operation services

| Function | Required action |
| --- | --- |
| `get_job` / `list_jobs` / `list_job_clips` / `list_clips` / `get_clip` | Query only owned records. Stable ordering: jobs by created_at+ID descending, job clips by clip_id, library by created_at+clip_uid. Cursor binds filter/order and is validated. Sign media on authorized reads; no local path or raw storage credentials in responses. |
| `sign_clip_assets` | Temporary GET URLs for private MP4/image/VTT, correct content types and expiry. Download URL signs Content-Disposition attachment with a sanitized filename. Do not persist URLs in place of durable object keys. |
| `issue_events_ticket` / `stream_job_events` | Follow first-message ticket protocol in README, verify origin/session, enforce per-user connection limits, replay after cursor, respect buffer limits and terminal states. Polling remains available. |
| `update_clip` | Save publication title/caption/hashtags with expected_version. Increment revision, clear incompatible approval and block affected undispatched schedule entries. Reject edits once publication dispatch begins. Never interpret the post caption textbox as a transcript/render command. |
| `approve_clip` / `approve_clip_batch` | Record actor, exact clip revision, decision and timestamp. Batch is atomic: reject the batch on non-owned/stale entries rather than partially approving without notice. |
| `render_clip_revision` | Queue Operation using stored source/strategy and validated requested changes. Re-run bounded render/persist/verify steps, then atomically replace active revision and reset approval. Expose failure without losing previous playable files. |
| `repair_job_storage` | Inspect manifests/objects; retry missing upload from durable intermediates or enqueue regeneration from retained source. If recovery data is gone, report `SOURCE_EXPIRED`; never claim ephemeral paths can always restore it. |
| `delete_job` | Require no active render or publication; tombstone and queue scoped R2 cleanup. Revoke future signing, delete only job-owned unshared assets after reference checks. Report asynchronous deletion progress. Existing signed links may remain usable until expiry; published YouTube copies are not removed by this endpoint. |
| `get_operation` | Return actual phase/progress/result/error for owned audit, analytics sync, rerender, deletion, storage repair or publication. No process-local result dictionaries. |

## YouTube channel and intelligence adapters

`start_youtube_oauth` binds a random single-use state and PKCE verifier to the verified user, allowed callback URI, expiry and requested purpose. Request minimal scopes (`youtube.readonly`, `yt-analytics.readonly` for analytics; incremental `youtube.upload` for publishing where needed). `finish_youtube_oauth` checks state and provider response, exchanges code on the server, verifies channel identity, stores encrypted refresh token/scopes, and redirects to an allowlisted app page. Never use a `user_id` query parameter as the user binding. Separate this from Supabase Google sign-in. [Google OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server)

`refresh_youtube_credentials` handles refresh/revocation using server-only tokens. `disconnect_youtube` revokes provider access where supported, removes token material, disables pending publishing, and applies provider data-deletion requirements. Channel status exposes display/profile/capabilities only.

`start_channel_audit` creates a durable Operation. `analyze_channel` validates allowed channel URLs, resolves IDs via official provider APIs, gathers permitted evidence, computes a strategy, persists AuditResult and evidence timestamps/sample sizes, and completes the operation. A public channel's basic metadata does not provide private retention analytics. Do not infer unavailable private data. Failure/insufficient data is explicit.

`start_analytics_sync` queues a deduplicated user/channel sync. `sync_channel_analytics` requests authorized metrics, tracks the reporting interval/timezone and provider delay, stores per-published-video mappings and aggregates, and creates evidence-backed next-batch directives. `get_analytics` returns saved data and its freshness status. No data means null measurements and no invented growth/retention numbers. Record metric units and denominators; average-percent-viewed may exceed 100 due to replays. Deprecated alias routes share the same action/deduplication, not separate jobs. [YouTube Analytics reports](https://developers.google.com/youtube/analytics/reference/reports/query)

## Approval, calendar and publishing actions

| Function | Required action |
| --- | --- |
| `save_schedule` / `get_schedule` | Store frequency/test mode/approval mode/timezone and both switches. Preserve omitted fields for compatibility. Settings do not constitute clip approval, a publish command, or a subscription upgrade. |
| `propose_schedule` | Only choose owned approved current revisions. Generate suggested slots in requested range; honor frequency/timezone, known conflicts and protected long-form windows. Return a proposal, no writes/publishing. Warn when insufficient approved clips exist. If protection is enabled but reliable long-form windows cannot be obtained, return `LONG_FORM_SCHEDULE_UNAVAILABLE`, not an invented guarantee. |
| `create_schedule_entry` | Explicit user acceptance schedules one approved revision. Validate future UTC instant, IANA timezone, account/channel permission, version, collisions and selected privacy. Record the revision and audit action. Do not require publishing_enabled to save a plan, but expose blocked status and never dispatch while disabled. |
| `update_schedule_entry` / `cancel_schedule_entry` | Optimistic concurrency, revalidate revised slot/approval, and refuse alteration once dispatch is in progress. Cancellation after external dispatch cannot promise recall. |
| `dispatch_due_publications` | Periodic private task claims due rows atomically. Recheck approval revision, entitlement, channel/scopes, publish feature flag and protected windows. Create one publication/outbox per entry version. No draft/unapproved clip may be dispatched. |
| `publish_approved_clip` | Recheck the dispatch claim, read the approved R2 revision, create and durably save a resumable YouTube upload session, stream bytes, then store provider video ID/status and publishing mapping. Use the exact approved title/caption/hashtags/privacy. Record provider errors and quota delay; do not bypass scope/audit restrictions. |
| `reconcile_publication` | On timeout/worker loss, resume/query the existing upload session or resolve a stored provider video ID before any new upload. If the external outcome cannot be determined, set `needs_reconciliation`, block retries and alert for review. Do not promise external exactly-once from a database flag. |
| `get_publication` | Surface real provider URL/video ID, status, and retry/reconciliation reason to the owner. A successful file upload is not proof that a video is public or has finished provider processing. |

For v1 the scheduler starts the upload at the chosen dispatch time, so actual visibility may be later due to upload/transcoding. Report this behavior. If later switching to YouTube-native scheduled publishing, persist/update/reconcile provider `publishAt` explicitly rather than quietly changing semantics. Provider projects may need audit approval before uploaded videos can be public. [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)

## Billing and maintenance

`create_checkout` accepts only `plan_key: shoort_monthly`. It derives account/email, product ID, price and success URL server-side, creates an idempotent Creem checkout and saves its user/customer binding. Do not require paid entitlement to buy/repair access. `create_billing_portal` uses only that trusted customer binding. `get_billing_status` returns trusted current state.

`receive_creem_webhook` verifies HMAC-SHA256 over the exact raw body using constant-time comparison, stores a unique provider event record, and acknowledges after durable receipt. `apply_billing_event` matches the known checkout/customer/product to a user, prevents replay, resolves out-of-order/ambiguous subscription events using provider current state, and updates grant/subscription/access together. `subscription.paid` activates through the verified paid period; scheduled cancellation retains only paid-through access; past-due/expired/cancelled state is reconciled to the chosen documented policy. Refunds/disputes default to review/hold for new paid work rather than silently extending access. Never grant from a browser success URL. [Creem signature and events](https://docs.creem.io/code/webhooks)

`reconcile_entitlements` expires trials/paid access and corrects stale projections from trusted grants/provider state, without touching legitimate admin grants. `cleanup_expired_resources` expires unfinished sessions, unclaimed sources and artifacts past declared retention, with ownership/reference checks, bounded batches and auditable deletion. `reconcile_work` also observes failed webhook processing and publishing uncertainty. Every maintenance function reports counts, failures, and request IDs; never silently drops failed work.
