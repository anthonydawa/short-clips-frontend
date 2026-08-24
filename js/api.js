/**
 * Short Clips AI — REST API Client
 * Interfaces with FastAPI endpoints and injects Supabase JWT Bearer token.
 */

import { CONFIG } from './config.js';
import { getAccessToken } from './supabase.js';

const wait = (ms = 350) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function mockRequest(endpoint, options = {}) {
  await wait();
  let body = {};
  if (typeof options.body === 'string') {
    try { body = JSON.parse(options.body); } catch (_) {}
  }
  if (endpoint === CONFIG.ENDPOINTS.pilotApplications) return { application_id: `pilot_${Date.now()}`, status: 'received_locally' };
  if (endpoint === CONFIG.ENDPOINTS.channelAudit) throw new Error('Channel analysis server is not connected yet.');
  if (endpoint.startsWith(CONFIG.ENDPOINTS.brands) && options.method === 'POST') return { ...body, brand_id: body.brand_id || `brand_${Date.now()}` };
  if (endpoint === CONFIG.ENDPOINTS.brands || endpoint.startsWith(`${CONFIG.ENDPOINTS.brands}?`)) return [];
  if (endpoint === CONFIG.ENDPOINTS.submitJob || endpoint === CONFIG.ENDPOINTS.uploadJob) throw new Error('Video processing server is not connected yet.');
  if (endpoint === CONFIG.ENDPOINTS.analytics || endpoint.includes('/auth/youtube/analytics')) return null;
  if (endpoint.includes('/auth/youtube/status')) return { connected: false, is_connected: false };
  if (endpoint === CONFIG.ENDPOINTS.schedule) throw new Error('Scheduling server is not connected yet.');
  if (endpoint.startsWith(CONFIG.ENDPOINTS.jobs)) return endpoint.match(/\/jobs\/[^/]+$/) ? { job: null, clips: [] } : [];
  throw new Error('This server endpoint is not connected yet.');
}

async function request(endpoint, options = {}) {
  if (CONFIG.MOCK_MODE) return mockRequest(endpoint, options);
  const url = `${CONFIG.BACKEND_URL}${endpoint}`;
  const token = await getAccessToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type for FormData multipart uploads
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { detail: response.statusText };
      }
      throw new Error(errorData.detail || errorData.message || `API Request Failed: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error(`API error [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Pilot onboarding
  applyForPilot: (payload) => request(CONFIG.ENDPOINTS.pilotApplications, { method: 'POST', body: JSON.stringify(payload) }),

  // Auth
  getMe: () => request('/api/v1/auth/me'),

  // Brands
  getBrands: (limit = 50) => request(`/api/v1/brands?limit=${limit}`),
  getBrand: (brandId) => request(`/api/v1/brands/${brandId}`),
  createBrand: (payload) => request('/api/v1/brands', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateBrand: (brandId, payload) => request(`/api/v1/brands/${brandId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  deleteBrand: (brandId) => request(`/api/v1/brands/${brandId}`, {
    method: 'DELETE',
  }),
  analyzeChannel: (channelUrl, additionalContext = '') => request('/api/v1/brands/analyze-channel', {
    method: 'POST',
    body: JSON.stringify({
      channel_url: channelUrl,
      additional_context: additionalContext,
    }),
  }),

  // Jobs & Ingestion
  submitJob: (payload) => request('/api/v1/jobs/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadVideo: (formData) => request('/api/v1/jobs/upload', {
    method: 'POST',
    body: formData,
  }),
  getJobs: (brandId = '', limit = 50) => {
    const query = brandId ? `?brand_id=${brandId}&limit=${limit}` : `?limit=${limit}`;
    return request(`/api/v1/jobs${query}`);
  },
  getJobDetail: (videoId) => request(`/api/v1/jobs/${videoId}`),
  getJobClips: (videoId) => request(`/api/v1/jobs/${videoId}/clips`),
  retryJob: (videoId) => request(`/api/v1/jobs/${videoId}/retry`, { method: 'POST' }),
  deleteJob: (videoId) => request(`/api/v1/jobs/${videoId}`, { method: 'DELETE' }),

  // Storage & Analytics
  getStorageHealth: () => request('/api/v1/storage/health'),
  syncStorage: (videoId) => request(`/api/v1/storage/sync/${videoId}`, { method: 'POST' }),
  getAnalyticsOverview: async () => {
    try {
      return await request('/api/v1/analytics/overview');
    } catch (e) {
      return await request('/api/v1/auth/youtube/analytics');
    }
  },
  syncAnalytics: async () => {
    try {
      return await request('/api/v1/analytics/sync', { method: 'POST' });
    } catch (e) {
      return await request('/api/v1/auth/youtube/sync', { method: 'POST' });
    }
  },

  // Agent test schedule
  updateSchedule: (payload) => request(CONFIG.ENDPOINTS.schedule, { method: 'PUT', body: JSON.stringify(payload) }),

  // YouTube Channel OAuth Integration
  getYouTubeStatus: () => request('/api/v1/auth/youtube/status'),
  disconnectYouTubeChannel: () => request('/api/v1/auth/youtube/disconnect', { method: 'DELETE' }),
  connectYouTubeChannel: (userId = '') => {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    window.location.href = `${CONFIG.BACKEND_URL}/api/v1/auth/youtube/connect${query}`;
  },



  // URL Helper to resolve playable video URL (R2 cloud or local workspace streaming)
  getVideoStreamUrl: (clip, jobSlug) => {
    if (!clip) return '';
    if (clip.r2_video_url) return clip.r2_video_url;
    const filename = clip.video_path ? clip.video_path.split(/[\\/]/).pop() : '';
    if (!filename) return '';
    const slug = jobSlug || clip.job_slug || `job_${clip.video_id}`;
    return `${CONFIG.BACKEND_URL}/workspace/jobs/${slug}/05_clips/${filename}`;
  },

  // Helper for subtitle URL
  getSubtitleStreamUrl: (clip, jobSlug) => {
    if (!clip) return '';
    if (clip.r2_subtitle_url) return clip.r2_subtitle_url;
    const filename = clip.subtitle_path ? clip.subtitle_path.split(/[\\/]/).pop() : '';
    if (!filename) return '';
    const slug = jobSlug || clip.job_slug || `job_${clip.video_id}`;
    return `${CONFIG.BACKEND_URL}/workspace/jobs/${slug}/05_clips/${filename}`;
  }
};
