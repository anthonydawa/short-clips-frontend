/**
 * Short Clips AI — REST API Client
 * Interfaces with FastAPI endpoints and injects Supabase JWT Bearer token.
 */

import { CONFIG } from './config.js';
import { getAccessToken } from './supabase.js';
import { getMediaUrl } from './media.js';
import { uploadSourceVideo } from './uploads.js';

const wait = (ms = 350) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function mockRequest(endpoint, options = {}) {
  await wait();
  let body = {};
  if (typeof options.body === 'string') {
    try { body = JSON.parse(options.body); } catch (_) {}
  }
  if (endpoint === CONFIG.ENDPOINTS.pilotApplications) return { application_id: `pilot_${Date.now()}`, status: 'received_locally' };
  if (endpoint === CONFIG.ENDPOINTS.billingCheckout) return { configured: false, checkout_url: null, message: 'Creem checkout is ready to connect after the product and API keys are added.' };
  if (endpoint === CONFIG.ENDPOINTS.billingStatus) return { configured: false, status: 'pending_setup' };
  if (endpoint === CONFIG.ENDPOINTS.billingPortal) return { configured: false, portal_url: null };
  if (endpoint === CONFIG.ENDPOINTS.channelAudit) throw new Error('Channel analysis server is not connected yet.');
  if (endpoint.startsWith(CONFIG.ENDPOINTS.brands) && options.method === 'POST') return { ...body, brand_id: body.brand_id || `brand_${Date.now()}` };
  if (endpoint === CONFIG.ENDPOINTS.brands || endpoint.startsWith(`${CONFIG.ENDPOINTS.brands}?`)) return [];
  if (endpoint === CONFIG.ENDPOINTS.submitJob) throw new Error('Video processing server is not connected yet.');
  if (endpoint.startsWith('/api/v1/uploads')) throw new Error('Cloud storage uploads are not connected yet.');
  if (endpoint === '/api/v1/storage/health') return { configured: false, provider: 'r2' };
  if (endpoint === CONFIG.ENDPOINTS.analytics || endpoint.includes('/auth/youtube/analytics')) return null;
  if (endpoint.includes('/auth/youtube/status')) return { connected: false, is_connected: false };
  if (endpoint.includes('/approval')) return { status: body.decision || 'approved', approved_version: body.expected_version || 1, ...body };
  if (endpoint.includes('/approvals')) return { approved_count: body.clips?.length || 1, decision: body.decision || 'approved' };
  if (endpoint === CONFIG.ENDPOINTS.schedule) return { frequency: 'daily_1', test_mode: false, approval_mode: body.approval_mode || 'manual_every_clip', auto_fill: body.auto_fill ?? false, ...body };
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
      const detail = Array.isArray(errorData.detail)
        ? errorData.detail.map((item) => item.msg || 'Invalid request').join('; ')
        : errorData.detail;
      throw new Error(detail || errorData.message || `API Request Failed: ${response.status}`);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
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

  // Billing. The backend owns the Creem product ID, price, API key, and success URL.
  createBillingCheckout: () => request(CONFIG.ENDPOINTS.billingCheckout, {
    method: 'POST',
    body: JSON.stringify({ plan_key: CONFIG.BILLING_PLAN_KEY }),
  }),
  getBillingStatus: () => request(CONFIG.ENDPOINTS.billingStatus),
  createBillingPortal: () => request(CONFIG.ENDPOINTS.billingPortal, { method: 'POST' }),

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
  uploadVideo: async (file, payload, options) => {
    const sourceUploadId = await uploadSourceVideo(file, request, options);
    options?.onUploaded?.();
    // Only the server-owned upload reference goes to Cloud Run, never bytes
    // or a client-chosen bucket/key. Do not automatically retry job creation.
    return request(CONFIG.ENDPOINTS.submitJob, {
      method: 'POST', body: JSON.stringify({ ...payload, source_upload_id: sourceUploadId }),
    });
  },
  getJobs: (brandId = '', limit = 50) => {
    const query = brandId ? `?brand_id=${brandId}&limit=${limit}` : `?limit=${limit}`;
    return request(`/api/v1/jobs${query}`);
  },
  getJobDetail: (videoId) => request(`/api/v1/jobs/${videoId}`),
  getJobClips: (videoId) => request(`/api/v1/jobs/${videoId}/clips`),
  retryJob: (videoId) => request(`/api/v1/jobs/${videoId}/retry`, { method: 'POST' }),
  deleteJob: (videoId) => request(`/api/v1/jobs/${videoId}`, { method: 'DELETE' }),

  // Clips
  getClips: (limit = 100) => request(`/api/v1/clips?limit=${limit}`),
  getClip: (clip_uid) => request(`/api/v1/clips/${clip_uid}`),
  updateClip: (clip_uid, payload) => request(`/api/v1/clips/${clip_uid}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteClip: (clip_uid) => request(`/api/v1/clips/${clip_uid}`, { method: 'DELETE' }),
  approveClip: (clip_uid, payload = { decision: 'approved' }) => request(`/api/v1/clips/${clip_uid}/approval`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  approveClipBatch: (payload) => request('/api/v1/clips/approvals', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  renderClip: (clip_uid, payload) => request(`/api/v1/clips/${clip_uid}/render`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

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
  getSchedule: () => request(CONFIG.ENDPOINTS.schedule),
  updateSchedule: (payload) => request(CONFIG.ENDPOINTS.schedule, { method: 'PUT', body: JSON.stringify(payload) }),

  // YouTube Channel OAuth Integration
  getYouTubeStatus: () => request('/api/v1/auth/youtube/status'),
  disconnectYouTubeChannel: () => request('/api/v1/auth/youtube/disconnect', { method: 'DELETE' }),
  connectYouTubeChannel: (userId = '') => {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    window.location.href = `${CONFIG.BACKEND_URL}/api/v1/auth/youtube/connect${query}`;
  },



  getVideoStreamUrl: (clip, jobSlug) => getMediaUrl(clip, 'video', jobSlug),
  getSubtitleStreamUrl: (clip, jobSlug) => getMediaUrl(clip, 'subtitles', jobSlug),
  getThumbnailUrl: (clip) => getMediaUrl(clip, 'thumbnail'),
  getDownloadUrl: (clip) => getMediaUrl(clip, 'download'),
};
