# Shoort Clips frontend API contract

The frontend ships in safe demo mode. Every product action uses the same client that will connect to the Google Cloud editing service, but returns local demo responses until the real API is enabled.

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

Run `SUPABASE_USER_ACCESS_SETUP.sql` once in the SQL Editor for the Supabase project used by the frontend. It creates a protected `user_access` table and automatically gives every existing and future account active `test_user` access.

Supported access types:

- `test_user` — current default during product development.
- `free_trial` — assign manually after accepting a free-trial request.
- `paid` — assign after payment is verified.

Users can read their own access row but cannot change their own access type or activation status. Change access from the Supabase Table Editor, or execute an admin-only update in the SQL Editor:

```sql
update public.user_access
set access_type = 'free_trial', is_active = true
where user_id = 'THE_AUTH_USER_UUID';
```

When the Google Cloud processing API is connected, it must validate the Supabase JWT and check `user_access.is_active` server-side before accepting a video job. The frontend access check is for user experience only and is not a security boundary.

The Supabase connection remains in `js/config.js`. Authentication is disabled at startup for the current preview, but the existing email/password and Google OAuth modal is preserved and can be activated with `AUTH_ENABLED: true`.

## Ready endpoints

| Purpose | Method | Endpoint |
| --- | --- | --- |
| Pilot application | POST | `/api/v1/pilot/applications` |
| List/create brands | GET/POST | `/api/v1/brands` |
| Analyze a channel | POST | `/api/v1/brands/analyze-channel` |
| Submit YouTube job | POST | `/api/v1/jobs/submit` |
| Upload source video | POST multipart | `/api/v1/jobs/upload` |
| List jobs | GET | `/api/v1/jobs` |
| Job detail and clips | GET | `/api/v1/jobs/{video_id}` |
| Job progress | WebSocket | `/api/v1/ws/jobs/{video_id}` |
| Analytics overview | GET | `/api/v1/analytics/overview` |
| Refresh analytics | POST | `/api/v1/analytics/sync` |
| Save test schedule | PUT | `/api/v1/schedule` |
| YouTube OAuth status | GET | `/api/v1/auth/youtube/status` |

Authenticated requests send the Supabase access token as `Authorization: Bearer <token>`. Uploads use `FormData`; all other writes send JSON.

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
