# Backend acceptance tests and required evidence

The backend builder must automate these scenarios where practical and provide a staging evidence report. Tests use synthetic/permitted media and provider test accounts. A 200 response from a stub is not sufficient: verify R2 objects, database states, worker logs/metrics and playable output. Do not include JWTs, provider tokens, signed URLs, private transcript text, raw webhook secrets or user media in the report.

## Contract and deployment

- OpenAPI validates as 3.1 and every documented operation is implemented or returns `503 FEATURE_NOT_CONFIGURED` consistently with `/capabilities`. No unlisted public internal/admin route exists.
- Response/error examples validate against schemas. Unknown privileged input fields are rejected. Actual deployment reports its contract/version/commit/image digest.
- All public authenticated routes reject missing, malformed, expired, wrong issuer/audience/algorithm and non-user tokens. Forged `user_metadata.signup_source=admin_invite` never creates access. Trusted test grants still work.
- Owner A cannot infer/read/edit/sign/stream/delete Owner B's brand, upload, job, clip, operation, schedule, publication or billing state. IDs return 404. Test service-role code paths too.
- Exact CORS origins work; wildcard/evil Origin fails authenticated API, R2 browser requests and WebSocket. Error responses have safe request IDs, no stack/secret/path leakage.
- Internal routes reject public/Supabase tokens and wrong Google service accounts/audiences, and are absent from the public service route table.

## Upload and R2

- Valid MP4/MOV/MKV/AVI at boundaries; zero, unsupported, mislabeled/corrupt, oversized and excessive pending-byte cases fail before expensive work. A valid MIME header with non-video bytes is rejected by worker probe.
- Multi-part upload spanning at least three parts: only requested owned key/part is signed, browser PUT succeeds, ETag is readable, manifest is ordered, final byte size/checksum/metadata match. Duplicate complete returns same result.
- Missing/duplicate/out-of-range/wrong ETags fail. Expired signature/session and forged upload ID fail. Completion network uncertainty is reconciled via R2 state.
- Cancel before/while/after a part is idempotent; claimed source cannot be aborted. Orphan multipart and unclaimed source cleanup works without deleting active/retained assets.
- Output video supports byte-range playback; image loads; VTT parses/synchronizes; attachment filename is safe. Signed read URLs expire, cannot cross tenants, and refresh via GET job/clip. R2 credentials/keys never reach browser/logs.

## Five-clip pipeline

- Submit one completed upload with `target_clip_count:5`: API returns 202 promptly and one product job; quota/upload claim/outbox are committed together.
- Worker produces exactly five distinct intervals and five independently verified video/image/VTT manifests. Job has requested/generated `5/5`, terminal completed 100%, ordered clips, and all files play/read. No duplicate bytes/intervals used to pad count.
- Each stage persists monotonic progress; browser reload gets current GET snapshot. Event tickets are one-use/user/job/session scoped, expire, require correct Origin/first-message auth, replay after cursor, and reveal no data beforehand.
- Force API restart, worker restart/timeout, dispatch ambiguity and duplicate Cloud Task delivery. Results remain one logical job, attempt fencing blocks stale writes, completed clips are not duplicated, quota settles once, work is eventually completed/failed and visible.
- Transcription failure, no audio, corrupt source, insufficient speech, bad model JSON, invalid timestamps, FFmpeg failure, R2 partial outage and model/provider throttling produce bounded retry/actionable states. No endless processing or fake outputs.
- Insufficient distinct moments returns real partial count and warning; zero outputs returns failed. Retry only recreates missing/invalid outputs. Cancel stops at safe checkpoint and settles quota.
- Prompt-injection strings in transcript/title/instructions cannot alter authorization, call internal actions, expose secrets, change storage keys or publish. User filenames/titles never enter a shell command or rendered HTML unsafely.
- Rendered media meets declared codec/pixel/duration/audio/caption rules. Auto-crop low confidence emits fallback warning. Scratch files are removed, durable files remain.

## Brands, usage and operations

- Bootstrap/create/update/default brand behavior is idempotent and versioned. Same ID from another owner conflicts without overwrite. In-flight job uses saved strategy snapshot after brand edit.
- Concurrent submissions at quota boundary reserve atomically; only permitted calls succeed. Unknown duration is rechecked before expense. Retry/cancel/failure/partial settles reservation once. `/auth/me` usage matches ledger.
- Operation polling survives service restart and returns correct typed result/error. Concurrent sync/rerender deduplicates using idempotency keys. Same key+payload returns result; same key+changed payload is 409.
- Clip post-metadata edit increments version and invalidates stale approval/schedule. Rerender failure retains old media; success switches immutably and resets approval.

## YouTube and analytics (only if capability enabled)

- OAuth starts only from authenticated POST. State/PKCE are high entropy, one-use, expiring and user/session/redirect bound. Forged/replayed/mismatched state/code, provider error and wrong callback fail without attaching a channel. Query `user_id` cannot bind OAuth.
- Scopes are minimal and incremental; connect/disconnect/revoked refresh-token states behave correctly. Refresh tokens are encrypted and absent from browser/logs/database-readable public surfaces.
- Audit uses real permitted channel evidence, identifies insufficient data and preserves evidence/sample/freshness. User text/provider metadata is not executed as instructions or unescaped HTML.
- Analytics sync uses the authorized channel and documented date range/units, maps published IDs, handles API quota/delay/replays, and never fabricates retention. Empty/unconnected/stale states match schema.
- Data-retention/deletion behavior complies with configured provider policy; one content owner's analytics is never exposed/aggregated for another.

## Billing and access (only if capability enabled)

- Public pilot intake is throttled, has generic response, stores no password and grants no access. Trusted approval/invite is single-use, attributable and time-bounded.
- Checkout derives user/email/product/price/success URL server-side; forged product/customer/metadata cannot change access. Idempotent clicks reuse checkout as designed.
- Creem webhook verifies exact raw-body HMAC with constant-time comparison; bad/missing signatures fail. Valid duplicate event produces one effect. Unknown event records safely.
- Paid, scheduled-cancel, past-due, expired, cancelled, refund/dispute and out-of-order events reconcile against trusted provider/customer/product. Browser success URL alone never activates. Trial/paid expiry is enforced by API and maintenance, not only UI.
- Signing/deleting user sessions/access changes are reflected according to declared revocation policy for new expensive work and WebSockets.

## Approval, schedule and publishing (only if capability enabled)

- Draft/stale/rejected/foreign clip cannot be scheduled or published. Approve exact revision, edit it, and prove dispatch blocks until reapproval. Batch approve is atomic.
- Schedule preferences persist timezone/switches/version. Proposal respects date range/frequency/known conflicts and contains only approved clips but writes nothing. Missing long-form-window data cannot claim protection.
- Creating an entry is explicit and versioned; DST ambiguous/nonexistent times, duplicates, past slots, collisions and dispatch races behave predictably. Cancel before claim prevents publication; cancel after external dispatch reports uncertainty instead of false recall.
- Due dispatcher checks entitlement, channel/scopes, feature flag, approval/revision and privacy again. Feature off leaves blocked entries and does not call provider.
- Force timeout after provider accepts bytes but before response. Reconciliation resumes/queries the original upload or marks manual review; no second YouTube video is created from blind retry.
- Authorized test-channel publication produces the selected approved revision/title/caption/tags/privacy and stores provider ID/status. Provider processing/private-audit restrictions are shown honestly. Scheduling does not promise exact visibility time.

## Operational/release evidence

- Metrics/dashboard: queued/oldest age, active/lease-stale jobs, per-stage latency/failure, render/minutes/outputs, R2 error/bytes, model/provider error/cost, partial ratio, webhook lag, publication uncertainty, quota/reservations.
- Alerts exercised for stuck queue/worker, failed cleanup, billing event backlog, quota exhaustion and publication reconciliation. Logs redact by tests and have trace/request/work IDs.
- Staging load test covers configured concurrent API clients/uploads/jobs/WebSockets without DB/connection/scratch exhaustion. Costs/limits/scale ceilings and denial behavior are reported.
- Backup/restore and rollback procedure is tested for metadata/migrations. R2 retention/deletion and orphan cleanup produce audit evidence. Image/version rollback does not corrupt active attempts.
- Completed `deployment-report.template.json`, test command output, migration/advisor reports, non-sensitive example job ID, five-output manifest/checksums and known limitations are returned.
