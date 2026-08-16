/**
 * Short Clips AI — REST API Client
 * Interfaces with FastAPI endpoints and injects Supabase JWT Bearer token.
 */

import { CONFIG } from './config.js';
import { getAccessToken } from './supabase.js';

async function request(endpoint, options = {}) {
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
  getAnalyticsOverview: () => request('/api/v1/analytics/overview'),
  syncAnalytics: () => request('/api/v1/analytics/sync', { method: 'POST' }),

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
