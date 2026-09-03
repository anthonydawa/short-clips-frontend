/**
 * Short Clips AI — Real-Time WebSocket & Polling Job Streaming Client
 */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { api } from './api.js';
import { getJobCompletion } from './jobCompletion.js';

let activeSocket = null;
let reconnectTimer = null;
let pollTimer = null;
let currentTrackingVideoId = null;

async function handleJobCompleted(videoId) {
  console.log('🎉 Job complete! Loading clips and details for:', videoId);
  try {
    const detail = await api.getJobDetail(videoId);
    if (detail?.job) {
      state.setActiveJob(detail.job);

      // Refresh jobs list so source category tabs update
      try {
        const jobsRes = await api.getJobs(state.activeBrandId || '', 50);
        const jobList = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.jobs || []);
        if (jobList.length) state.setJobs(jobList);
      } catch (e) {
        console.warn('Could not refresh jobs list:', e);
      }

      // Refresh ALL clips across all videos so earlier clips stay visible
      try {
        const allClipsRes = await api.getClips(100);
        const allClips = allClipsRes?.clips || [];
        if (allClips.length) {
          state.setClips(allClips);
        } else if (Array.isArray(detail.clips)) {
          state.setClips(detail.clips);
        }
      } catch (e) {
        if (Array.isArray(detail.clips)) {
          state.setClips(detail.clips);
        }
      }

      if (detail.clips?.length) {
        state.setSelectedClip(detail.clips[0]);
      }

      const completion = getJobCompletion(detail);
      state.updateProgress(completion.stage, 100, completion.message, true);
    } else {
      throw new Error('The server did not return a completed job and clips.');
    }
  } catch (fetchErr) {
    console.error('Error fetching completed job details:', fetchErr);
    state.updateProgress('FAILED', 100, 'The server reported completion, but clip media could not be loaded. Refresh the workspace to retry.', true);
  }
}

function startPolling(videoId) {
  if (pollTimer) clearInterval(pollTimer);
  currentTrackingVideoId = videoId;

  pollTimer = setInterval(async () => {
    if (currentTrackingVideoId !== videoId || !state.isProcessing) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }

    try {
      const detail = await api.getJobDetail(videoId);
      const job = detail?.job || detail;
      if (!job || currentTrackingVideoId !== videoId) return;

      const stage = job.stage || (job.status ? job.status.toUpperCase() : 'PROCESSING');
      const progress = typeof job.progress === 'number' ? job.progress : 0;
      const message = job.message || '';
      const terminal = stage === 'COMPLETED' || ['completed', 'partial', 'failed', 'cancelled'].includes(job.status);

      if (terminal) {
        clearInterval(pollTimer);
        pollTimer = null;
        if (job.status === 'failed') {
          state.updateProgress('FAILED', progress, job.error || message || 'Video processing failed.', true);
        } else {
          state.updateProgress('VERIFYING_MEDIA', progress, 'Checking completed clip media…', true);
          await handleJobCompleted(videoId);
        }
      } else {
        state.updateProgress(stage, progress, message, true);
      }
    } catch (err) {
      console.warn('⚠️ Polling job progress error:', err);
    }
  }, 2000);
}

export function connectJobWebSocket(videoId) {
  if (!videoId) return;

  if (CONFIG.MOCK_MODE) {
    state.updateProgress('FAILED', 0, 'Video processing server is not connected yet.', true);
    return;
  }

  // Close previous socket if any
  if (activeSocket) {
    activeSocket.close();
    activeSocket = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Start polling immediately in parallel for zero-latency fallback
  startPolling(videoId);

  const wsUrl = `${CONFIG.WS_BASE_URL}/api/v1/ws/jobs/${videoId}`;
  console.log(`🔌 Connecting WebSocket: ${wsUrl}`);

  try {
    const socket = new WebSocket(wsUrl);
    activeSocket = socket;

    socket.onopen = () => {
      console.log(`⚡ WebSocket Connected for job: ${videoId}`);
    };

    socket.onmessage = async (event) => {
      if (activeSocket !== socket) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return;
        console.log('📡 WebSocket Event:', data);

        const stage = data.stage || 'PROCESSING';
        const progress = typeof data.progress === 'number' ? data.progress : 0;
        const message = data.message || '';

        const terminal = stage === 'COMPLETED' || ['completed', 'partial'].includes(data.status);
        state.updateProgress(terminal ? 'VERIFYING_MEDIA' : stage, progress, terminal ? 'Checking completed clip media…' : message, true);

        if (terminal) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          await handleJobCompleted(videoId);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('⚠️ WebSocket encountered an error (HTTP polling fallback active):', err);
    };

    socket.onclose = (event) => {
      if (activeSocket !== socket) return;
      console.log(`🔌 WebSocket Closed (Code: ${event.code})`);
      activeSocket = null;

      // If job is still running and socket dropped, attempt reconnect
      if (state.isProcessing && state.progress.stage !== 'COMPLETED' && state.progress.stage !== 'FAILED') {
        reconnectTimer = setTimeout(() => {
          console.log('🔄 Attempting WebSocket reconnection...');
          connectJobWebSocket(videoId);
        }, 3000);
      }
    };
  } catch (err) {
    console.error('Failed to create WebSocket:', err);
  }
}

export function disconnectJobWebSocket() {
  currentTrackingVideoId = null;
  if (activeSocket) {
    activeSocket.close();
    activeSocket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
