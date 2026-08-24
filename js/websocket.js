/**
 * Short Clips AI — Real-Time WebSocket Job Streaming Client
 */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { api } from './api.js';

let activeSocket = null;
let reconnectTimer = null;

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

  const wsUrl = `${CONFIG.WS_BASE_URL}/api/v1/ws/jobs/${videoId}`;
  console.log(`🔌 Connecting WebSocket: ${wsUrl}`);

  try {
    const socket = new WebSocket(wsUrl);
    activeSocket = socket;

    socket.onopen = () => {
      console.log(`⚡ WebSocket Connected for job: ${videoId}`);
      state.updateProgress('CONNECTED', 0, 'Real-time WebSocket connected', true);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 WebSocket Event:', data);

        const stage = data.stage || 'PROCESSING';
        const progress = typeof data.progress === 'number' ? data.progress : 0;
        const message = data.message || '';

        state.updateProgress(stage, progress, message, true);

        // If completed or clips ready, fetch latest job details and clips
        if (stage === 'COMPLETED' || progress >= 100) {
          console.log('🎉 Job complete! Loading clips and details...');
          try {
            const detail = await api.getJobDetail(videoId);
            if (detail) {
              state.setActiveJob(detail.job);
              state.setClips(detail.clips || []);
            }
          } catch (fetchErr) {
            console.error('Error fetching completed job details:', fetchErr);
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('⚠️ WebSocket encountered an error:', err);
    };

    socket.onclose = (event) => {
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
  if (activeSocket) {
    activeSocket.close();
    activeSocket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
