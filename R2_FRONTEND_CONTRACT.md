# R2 storage and frontend readiness

For the complete Python API request, use [backend-handoff/README.md](backend-handoff/README.md) and its OpenAPI contract. This page describes the already-prepared browser storage transport; it is not the entire backend handoff.

Status: frontend preparation only. No R2 bucket, credentials, CORS policy, Python API routes, or Google Cloud services were created. Existing Cloudflare resources outside this repository have not been inspected.

## Responsibilities

- Frontend: validate/select files, upload bytes directly to signed R2 URLs, show progress/cancellation, and display API-provided video, thumbnail, subtitle, and download URLs.
- Google Cloud Python API: authenticate the Supabase JWT, authorize each upload/job/asset, sign storage requests, enqueue processing, and return job metadata. Long rendering work must run asynchronously rather than inside the submission response.
- Python worker: read source video from R2, generate clips/images/WebVTT subtitles, persist them to R2, and save durable object keys and job state.
- Supabase: authentication and durable metadata. Store object keys, not expiring signed URLs, as the durable media references.
- R2: private source videos and generated media. Issue short-lived read links per authorized user. A public bucket is not required for the app or an authorized agent to view images.

Never put an R2 secret/access key or Supabase service-role key in the frontend. R2 credentials stay in backend secret configuration. The frontend has no R2 SDK or bucket credentials.

Direct uploads avoid routing large video requests through Cloud Run. Google documents a 32 MiB request limit for HTTP/1 servers; HTTP/2 servers have different limits. See [Cloud Run limits](https://docs.cloud.google.com/run/quotas). R2 provides [temporary presigned access](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Multipart source upload contract (pending Python implementation)

All API operations below require user authorization and ownership checks. IDs are opaque application IDs, not user-supplied bucket paths. The backend must enforce file/size/part limits independently of frontend validation and inspect actual media before processing.

1. `POST /api/v1/uploads` accepts `{ "filename": "interview.mp4", "content_type": "video/mp4", "size_bytes": 16777217 }`. Return `{ "upload_id": "upl_123", "part_size_bytes": 16777216 }`. The server creates the R2 multipart session and saves its R2 upload ID, owner, unique object key, content type, expected byte size, and expiration. Use a consistent part size between 5 and 100 MiB (16 MiB suggested).
2. `POST /api/v1/uploads/upl_123/parts/1` returns `{ "url": "https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/KEY?...signature...", "headers": {} }`. Sign only that upload's exact part number. The only optional returned header supported by the client is `Content-Type`; its value must match the signature. Browser uploads each slice as raw `PUT`, reads the exposed `ETag`, and retries a failed part at most twice with a newly signed URL. All non-final parts have the same size.
3. `POST /api/v1/uploads/upl_123/complete` accepts `{ "parts": [{ "part_number": 1, "etag": "\"ETAG_FROM_R2\"" }] }`. Complete R2 multipart, verify actual object size and owner, and return `{ "source_upload_id": "upl_123" }`. Keep ETags exactly as returned by R2. Completion must be idempotent and verify the full ordered part manifest.
4. `DELETE /api/v1/uploads/upl_123` aborts an incomplete multipart upload and returns `204`. It must be idempotent and must never delete a source already claimed by a processing job. Cancellation/error cleanup is best effort; expire orphaned sessions server-side and configure lifecycle cleanup for unfinished uploads and unclaimed completed sources.
5. `POST /api/v1/jobs/submit` accepts exactly one source: `url` (YouTube) **or** `source_upload_id`, plus `brand_id`, `target_clip_count`, `subtitle_preset`, and `custom_instructions`. Resolve the upload's object key server-side and validate its ownership/completed state. Return `{ "video_id": "vid_123", "job_slug": "interview", "status": "queued" }` promptly. Claim a source atomically so a duplicate submission cannot create duplicate processing charges.

The current client uploads parts sequentially, with byte progress and cancellation. It does not resume after a page reload. If job creation fails after upload, an unclaimed completed source may remain until server cleanup; there is no automatic retry of job creation. Backend signing/initiation calls must be bounded so the browser does not wait indefinitely during cleanup. The upload byte progress reaching 100% does not imply R2 multipart completion or video rendering has completed.

## Job media response

`GET /api/v1/jobs/{video_id}` returns `{ "job": { ... }, "clips": [...] }`, freshly signing authorized media URLs on each read:

```json
{
  "clip_uid": "clip_123",
  "clip_id": 1,
  "video_id": "vid_123",
  "generated_title": "A useful moment",
  "start_seconds": 12,
  "end_seconds": 42,
  "status": "ready",
  "assets": {
    "video": { "url": "https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/clip.mp4?...", "expires_at": "2026-09-01T00:00:00Z" },
    "thumbnail": { "url": "https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/clip.jpg?..." },
    "subtitles": { "url": "https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/clip.vtt?..." },
    "download": { "url": "https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/clip.mp4?...attachment-signature..." }
  }
}
```

Use browser-playable MP4 with a correct content type, byte-range support, and WebVTT for `<track>` subtitles. The download link must be signed with a server-controlled `Content-Disposition: attachment` response: the HTML `download` attribute alone does not guarantee a cross-origin download. Without a download URL the frontend labels the link **Open video** instead.

Legacy `r2_video_url`, `r2_subtitle_url`, `r2_thumbnail_url`, and `download_url` are supported. Local `video_path`/`subtitle_path` streaming is disabled by default; `ALLOW_LOCAL_MEDIA: true` is only for explicitly configured local development. The frontend never derives public URLs from R2 object keys.

The player has a **Refresh media links** action to fetch fresh signed URLs when media is unavailable/expired; there is no automatic proactive URL renewal yet. External media URLs must use HTTP(S), and server-provided text is escaped in the clip/player/processing UI.

`GET /api/v1/storage/health` should return `{ "provider": "r2", "configured": true }` without credentials or account details. `POST /api/v1/storage/sync/{video_id}` is an optional repair/retry action for an owned job, returning `{ "status": "queued" }` or `{ "status": "completed" }`. Normal processing must persist output automatically. The UI never treats an accepted sync request as proof that files were saved.

## R2 CORS and activation

Configure the actual frontend origin(s) on the bucket before enabling live uploads. Example dashboard JSON (adapt the domain and keep localhost only for development):

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

R2 signing uses the S3 API domain, not a custom public domain. Browser uploads need CORS even with a valid signature. See [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

Keep `MOCK_MODE: true` until the API, R2 signing, authorization, worker persistence, and authenticated job-progress delivery are implemented and tested together. Before production, test a real multi-part video upload, cancellation, denied cross-user access, expired URLs, thumbnails, captions, downloads, and reload recovery. Local contract/browser tests are not proof that the cloud services are connected.
