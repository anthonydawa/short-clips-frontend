# Endpoint catalog

Generated from openapi.json; 58 HTTP operations plus one WebSocket route. No routes are deployed.

Client status: **called** = currently invoked; **client-only** = helper exists but no complete UI flow; **change-required** = current call needs protocol/payload changes; **new** = future wiring; **legacy** = compatibility alias; **legacy-reject** = intentionally reject insecure old call.

| Method | Path | Phase | Client | Python action | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/healthz` | A | new | `health` | Public liveness (no dependency details) |
| GET | `/api/v1/capabilities` | A | new | `get_capabilities` | Read configured features and hard limits |
| GET | `/api/v1/auth/me` | A | client-only | `get_me` | Verified identity, entitlement and quota usage |
| POST | `/api/v1/workspace/bootstrap` | A | new | `bootstrap_workspace` | Idempotently create/load the verified user workspace |
| POST | `/api/v1/pilot/applications` | B1 | called | `create_pilot_application` | Record trial request; does not grant access |
| GET | `/api/v1/brands` | A | client-only | `list_brands` | List owned brands |
| POST | `/api/v1/brands` | A | called | `create_brand` | Create owned brand or update same-owner legacy ID |
| GET | `/api/v1/brands/{brand_id}` | A | client-only | `get_brand` | Read owned brand |
| PATCH | `/api/v1/brands/{brand_id}` | A | change-required | `update_brand` | Update brand with optimistic concurrency |
| DELETE | `/api/v1/brands/{brand_id}` | A | client-only | `delete_brand` | Delete empty owned brand |
| POST | `/api/v1/uploads` | A | called | `initialize_upload` | Create owned R2 multipart source upload |
| GET | `/api/v1/uploads/{upload_id}` | A | new | `get_upload` | Inspect owned upload and completed part manifest |
| DELETE | `/api/v1/uploads/{upload_id}` | A | called | `abort_upload` | Abort unclaimed incomplete source upload |
| POST | `/api/v1/uploads/{upload_id}/parts/{part_number}` | A | called | `sign_upload_part` | Sign exactly one owned R2 upload part |
| POST | `/api/v1/uploads/{upload_id}/complete` | A | called | `complete_upload` | Finalize and verify R2 object before accepting source |
| POST | `/api/v1/jobs/submit` | A | called | `submit_job` | Persist source job and enqueue real video generation |
| GET | `/api/v1/jobs` | A | called | `list_jobs` | List all owned jobs newest first |
| GET | `/api/v1/jobs/{video_id}` | A | called | `get_job` | Read durable progress and freshly signed clip assets |
| DELETE | `/api/v1/jobs/{video_id}` | A | client-only | `delete_job` | Queue owned job and artifact cleanup |
| GET | `/api/v1/jobs/{video_id}/clips` | A | client-only | `list_job_clips` | List owned job clips |
| POST | `/api/v1/jobs/{video_id}/retry` | A | client-only | `retry_job` | Retry failed stages/missing outputs without duplication |
| POST | `/api/v1/jobs/{video_id}/cancel` | A | new | `cancel_job` | Request cooperative cancellation |
| POST | `/api/v1/jobs/{video_id}/events-ticket` | A | new | `issue_events_ticket` | Issue one-use scoped WebSocket ticket |
| GET | `/api/v1/clips` | A | new | `list_clips` | Paginated library across all owned jobs |
| GET | `/api/v1/clips/{clip_uid}` | A | new | `get_clip` | Read owned clip with fresh media URLs |
| PATCH | `/api/v1/clips/{clip_uid}` | B3 | new | `update_clip` | Save post title/caption/hashtags; invalidate stale approval |
| POST | `/api/v1/clips/{clip_uid}/approval` | B3 | new | `approve_clip` | Approve/reject the exact clip revision |
| POST | `/api/v1/clips/approvals` | B3 | new | `approve_clip_batch` | Atomically approve/reject a named batch |
| POST | `/api/v1/clips/{clip_uid}/render` | B3 | new | `render_clip_revision` | Queue changed timing/crop/caption styling render |
| GET | `/api/v1/storage/health` | A | client-only | `get_storage_health` | Report R2 readiness without credentials |
| POST | `/api/v1/storage/sync/{video_id}` | A | called | `repair_job_storage` | Queue missing output storage repair |
| GET | `/api/v1/operations/{operation_id}` | A | new | `get_operation` | Poll owned audit/sync/render/publication operation |
| POST | `/api/v1/brands/analyze-channel` | B2 | change-required | `start_channel_audit` | Queue evidence-backed channel audit |
| GET | `/api/v1/analytics/overview` | B2 | called | `get_analytics` | Read saved authorized channel metrics/directives |
| POST | `/api/v1/analytics/sync` | B2 | change-required | `start_analytics_sync` | Queue real channel metric collection |
| GET | `/api/v1/auth/youtube/analytics` | B2 | legacy | `get_analytics` | Compatibility alias for analytics overview |
| POST | `/api/v1/auth/youtube/sync` | B2 | legacy | `start_analytics_sync` | Compatibility alias sharing sync deduplication |
| POST | `/api/v1/auth/youtube/connect` | B2 | change-required | `start_youtube_oauth` | Create user-bound OAuth consent URL |
| GET | `/api/v1/auth/youtube/connect` | B2 | legacy-reject | `reject_legacy_oauth_start` | Reject insecure user_id-based OAuth start |
| GET | `/api/v1/auth/youtube/callback` | B2 | new | `finish_youtube_oauth` | Validate state, exchange code and bind owned channel |
| GET | `/api/v1/auth/youtube/status` | B2 | called | `get_youtube_status` | Read channel connection/scopes |
| DELETE | `/api/v1/auth/youtube/disconnect` | B2 | called | `disconnect_youtube` | Revoke/remove tokens and block pending publishing |
| GET | `/api/v1/schedule` | B3 | new | `get_schedule` | Read account schedule preferences |
| PUT | `/api/v1/schedule` | B3 | change-required | `save_schedule` | Save preferences only; no implicit publication |
| POST | `/api/v1/schedule/generate` | B3 | new | `propose_schedule` | Propose slots for approved clips; does not persist/publish |
| GET | `/api/v1/schedule/entries` | B3 | new | `list_schedule_entries` | Read calendar entries in requested date range |
| POST | `/api/v1/schedule/entries` | B3 | new | `create_schedule_entry` | Explicitly schedule an approved clip revision |
| PATCH | `/api/v1/schedule/entries/{entry_id}` | B3 | new | `update_schedule_entry` | Move/change a not-yet-dispatched schedule entry |
| DELETE | `/api/v1/schedule/entries/{entry_id}` | B3 | new | `cancel_schedule_entry` | Cancel a not-yet-dispatched schedule entry |
| GET | `/api/v1/publications/{publication_id}` | B3 | new | `get_publication` | Read publication outcome/reconciliation state |
| POST | `/api/v1/billing/checkout` | B1 | called | `create_checkout` | Create server-priced Creem checkout |
| GET | `/api/v1/billing/status` | B1 | client-only | `get_billing_status` | Read trusted subscription and access state |
| POST | `/api/v1/billing/portal` | B1 | client-only | `create_billing_portal` | Create portal link for verified customer binding |
| POST | `/api/v1/webhooks/creem` | B1 | new | `receive_creem_webhook` | Verify raw signature and durably accept billing event |
| POST | `/internal/v1/dispatch` | A | new | `dispatch_work` | Start durable worker execution from owned work row |
| POST | `/internal/v1/maintenance/reconcile` | A | new | `reconcile_work` | Recover outbox, stale leases and provider uncertainty |
| POST | `/internal/v1/maintenance/cleanup` | A | new | `cleanup_expired_resources` | Clean expired orphan uploads/assets according to retention |
| POST | `/internal/v1/publishing/dispatch-due` | B3 | new | `dispatch_due_publications` | Claim due approved entries and enqueue publication work |

WebSocket: `/api/v1/ws/jobs/{video_id}`, Phase A; authenticated one-use first-message ticket. See README.md.
