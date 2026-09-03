import { getMediaUrl } from './media.js';

// A progress counter reaching 100 is not evidence of successful clip output.
export function getJobCompletion(detail) {
  const job = detail?.job || {};
  const clips = Array.isArray(detail?.clips) ? detail.clips : [];
  const available = clips.filter(clip => getMediaUrl(clip, 'video', job.job_slug)).length;
  const requested = Number(job.requested_clip_count) || clips.length;
  if (job.status === 'failed' || job.stage === 'FAILED') {
    return { stage: 'FAILED', message: job.message || 'Clip generation failed. Check the processing details.' };
  }
  if (!available || available !== clips.length) {
    return { stage: 'FAILED', message: clips.length
      ? `The server reported completion, but ${clips.length - available} of ${clips.length} clips have no usable video link. Check rendering and media storage before regenerating.`
      : 'The server reported completion without returning any clips. Check the processing job before regenerating.' };
  }
  if (available < requested || job.status === 'partial') {
    return { stage: 'PARTIAL', message: `${available} of ${requested} clips have media links. The requested batch is incomplete.` };
  }
  return { stage: 'COMPLETED', message: `${available} clips available to review.` };
}
