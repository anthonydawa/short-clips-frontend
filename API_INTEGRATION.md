# Shoort Clips frontend API contract

**Canonical backend implementation request:** see [backend-handoff/README.md](backend-handoff/README.md) and [backend-handoff/openapi.json](backend-handoff/openapi.json). That package covers the complete endpoint/function/cloud requirements and the client changes needed before live activation. This page is a frontend quick reference, not a complete server specification.

The frontend ships in preview mode (`MOCK_MODE: true`). Reads return empty preview data; processing, uploads, channel analysis, and scheduling report that the service is not connected. This repository does not contain a Python server, deployed API, or an R2 bucket setup.

Cloudflare R2 is the intended media store; Google Cloud runs the Python processing service. The browser-side multipart upload and media handling are implemented against the **pending** contract in [R2_FRONTEND_CONTRACT.md](R2_FRONTEND_CONTRACT.md). They have not been tested against a live R2 bucket.

## Enable the Google Cloud API

Add this before `js/app.js` on `app.html` and before `js/register.js` on `register.html`, or inject the same object through your Hostinger build/deployment flow:

```html
<script>
  window.SHOORT_CLIPS_CONFIG = {
    API_BASE_URL: 'https://YOUR-CLOUD-RUN-SERVICE.run.app',
    WS_BASE_URL: 'wss://YOUR-CLOUD-RUN-SERVICE.run.app',
    MOCK_MODE: false,
    AUTH_ENABLED: true
  };
</script>
```

## Local Supabase authentication test

`app.html` now enables Supabase authentication by default while keeping `MOCK_MODE` on. That means email and Google sign-in use your live Supabase project, but no video-processing jobs are sent to Google Cloud during this test.

Run the site through the local development server and open `http://127.0.0.1:5173/app.html` (not the `file:///` version). In Supabase Dashboard, add both of these redirect URL patterns under **Authentication → URL Configuration → Redirect URLs**:

```
http://127.0.0.1:5173/**
http://localhost:5173/**
```

For email/password testing, make sure the Email provider is enabled. If **Confirm email** is enabled, configure SMTP or use an inbox you can access. For Google sign-in, also configure the Google provider in Supabase and add Supabase's callback URL to your Google Cloud OAuth client.

## User access types

The repository contains historical `SUPABASE_USER_ACCESS_SETUP.sql`, but **do not use it unchanged for production**: its trigger can grant access from user-editable signup metadata. The backend handoff requires a trusted invitation/trial/payment grant flow, corrected migrations, and reconciliation of existing access rows before live processing is enabled.

Supported access types:

- `test_user` — explicitly granted by a trusted administrator/invitation flow, never by client signup metadata.
- `free_trial` — granted by the approved server-side eligibility flow, with an enforced expiry.
- `paid` — active only for the verified paid-through period, subject to suspension/reconciliation.

Users can read their own access row but cannot change their own access type or activation status. The builder must use a trusted audited grant procedure and maintain grant provenance; a direct row update alone should not become the permanent authorization model. Historical example of an administrator-only update:

```sql
update public.user_access
set access_type = 'free_trial', is_active = true
where user_id = 'THE_AUTH_USER_UUID';
```

When the Google Cloud processing API is connected, it must validate the Supabase JWT and check `user_access.is_active` server-side before accepting a video job. The frontend access check is for user experience only and is not a security boundary.

The Supabase connection remains in `js/config.js`. `app.html` enables authentication by default, independently of processing preview mode.

## Required backend endpoints (not implemented in this repository)

| Purpose | Method | Endpoint |
| --- | --- | --- |
| Pilot application | POST | `/api/v1/pilot/applications` |
| List/create brands | GET/POST | `/api/v1/brands` |
| Analyze a channel | POST | `/api/v1/brands/analyze-channel` |
| Submit YouTube job | POST | `/api/v1/jobs/submit` |
| Initialize R2 multipart upload | POST JSON | `/api/v1/uploads` |
| Sign one R2 upload part | POST | `/api/v1/uploads/{upload_id}/parts/{part_number}` |
| Complete upload | POST JSON | `/api/v1/uploads/{upload_id}/complete` |
| Cancel/clean up upload | DELETE | `/api/v1/uploads/{upload_id}` |
| Submit uploaded source | POST JSON | `/api/v1/jobs/submit` with `source_upload_id` |
| List jobs | GET | `/api/v1/jobs` |
| Job detail and clips | GET | `/api/v1/jobs/{video_id}` |
| Job progress | WebSocket | `/api/v1/ws/jobs/{video_id}` |
| Analytics overview | GET | `/api/v1/analytics/overview` |
| Refresh analytics | POST | `/api/v1/analytics/sync` |
| Save test schedule | PUT | `/api/v1/schedule` |
| YouTube OAuth status | GET | `/api/v1/auth/youtube/status` |

Authenticated API requests send the Supabase access token as `Authorization: Bearer <token>`. Writes use JSON. File bytes go directly to signed R2 URLs in raw `PUT` requests, without Supabase tokens or cookies. The old `POST multipart /api/v1/jobs/upload` path is no longer used by the frontend.

Additional existing client calls cover brand detail/update/delete, job clips/retry/delete, storage health/sync, billing, and YouTube connect/disconnect. These are also client contracts, not implemented server routes. Before implementing the Python API, inventory `js/api.js` and `CREEM_INTEGRATION.md`, including the required callback/webhook handlers. Job progress authentication is still pending: the current WebSocket client has no authentication handshake and must not be enabled against a public production stream without one.

## Expected job response

```json
{
  "video_id": "vid_123",
  "job_slug": "founder-interview-aug-22",
  "status": "queued"
}
```

Progress messages should contain `stage`, `progress` (0–100), and `message`. At completion, the frontend requests `/api/v1/jobs/{video_id}` and expects `{ "job": {}, "clips": [] }`.

## Hostinger deployment

Run `npm run build`, then upload the contents of `dist/` to `public_html`. Include the provided `.htaccess` alongside the built files. Configure CORS on the Google Cloud API for the final Hostinger domain; do not use a wildcard origin for authenticated endpoints.
