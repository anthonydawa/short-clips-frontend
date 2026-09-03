import { CONFIG } from './config.js';

export const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

// Media URLs are supplied by the authenticated API. Never build public URLs
// from private R2 keys, and never embed a Supabase token in a media URL.
export function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, CONFIG.BACKEND_URL);
    if (url.hostname === 'media.staging.shoortclips.com' || url.hostname.endsWith('.invalid')) return '';
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch (_) {
    return '';
  }
}

export function getClipMediaIssue(clip, jobSlug) {
  const raw = clip?.assets?.video?.url || clip?.r2_video_url || '';
  if (/^https?:\/\/media\.staging\.shoortclips\.com(?:\/|$)/i.test(raw)) {
    return 'The server returned a placeholder video link. This clip is not ready. Configure media storage and regenerate it from the original video.';
  }
  return getMediaUrl(clip, 'video', jobSlug) ? '' : 'No playable video is available for this clip. The server must finish rendering and upload the file before it can be played.';
}

export function getMediaUrl(clip, kind, jobSlug) {
  if (!clip) return '';
  const legacy = { video: 'r2_video_url', subtitles: 'r2_subtitle_url', thumbnail: 'r2_thumbnail_url', download: 'download_url' };
  const keys = { video: 'r2_video_key', subtitles: 'r2_subtitles_key', thumbnail: 'r2_thumbnail_key', download: 'r2_download_key' };

  const directUrl = clip.assets?.[kind]?.url || clip[legacy[kind]];
  const url = safeMediaUrl(directUrl);
  if (url) return url;

  // If r2 key is present, route directly through public R2 CDN or backend storage endpoint
  const r2Key = clip[keys[kind]];
  if (r2Key) {
    if (CONFIG.R2_PUBLIC_URL) {
      return `${CONFIG.R2_PUBLIC_URL}/${r2Key}`;
    }
    const dlParam = kind === 'download' && clip.generated_title ? `?dl=${encodeURIComponent(clip.generated_title)}.mp4` : '';
    return `${CONFIG.BACKEND_URL}/api/v1/storage/media/${r2Key}${dlParam}`;
  }

  // Local workspace streaming is only for an explicitly enabled local backend.
  if (!CONFIG.ALLOW_LOCAL_MEDIA || !['video', 'subtitles'].includes(kind)) return '';
  const filename = clip[kind === 'video' ? 'video_path' : 'subtitle_path']?.split(/[\\/]/).pop();
  const slug = clip.job_slug || jobSlug || (clip.video_id ? `job_${clip.video_id}` : '');
  return filename && slug
    ? `${CONFIG.BACKEND_URL}/workspace/jobs/${encodeURIComponent(slug)}/05_clips/${encodeURIComponent(filename)}`
    : '';
}
