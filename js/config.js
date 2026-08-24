/**
 * Short Clips AI — Frontend Configuration
 *
 * This file configures the connection to:
 * 1. Supabase Cloud (Authentication & Database)
 * 2. Short Clips Backend API (FastAPI + FFmpeg on Google Cloud / VPS / Localhost)
 */

export const CONFIG = {
  // ==========================================
  // 1. SUPABASE CREDENTIALS
  // ==========================================
  // Find these in: Supabase Dashboard → Project Settings → API
  SUPABASE_URL: 'https://dymsvtgktszfofeuwxjn.supabase.co',

  // ⚠️ IMPORTANT: Use your project's PUBLIC ANON key (role: anon)
  // NEVER put your service_role secret key here!
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bXN2dGdrdHN6Zm9mZXV3eGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjE2NDMsImV4cCI6MjEwMjQzNzY0M30.L3pdQmTJR1wB6fsp_Cytm0jL93rfePCLu2Emsq7VbEg',

  // ==========================================
  // 2. BACKEND API & WEBSOCKET CONFIGURATION
  // ==========================================
  // Runtime overrides can be added before app.js loads:
  // window.SHOORT_CLIPS_CONFIG = { API_BASE_URL: 'https://...', MOCK_MODE: false, AUTH_ENABLED: true };
  AUTH_ENABLED: window.SHOORT_CLIPS_CONFIG?.AUTH_ENABLED ?? false,
  MOCK_MODE: window.SHOORT_CLIPS_CONFIG?.MOCK_MODE ?? true,
  get BACKEND_URL() {
    return window.SHOORT_CLIPS_CONFIG?.API_BASE_URL || 'https://api.shoortclips.com';
  },

  // WebSocket Base URL (Automatically converts http/https to ws/wss)
  get WS_BASE_URL() {
    if (window.SHOORT_CLIPS_CONFIG?.WS_BASE_URL) return window.SHOORT_CLIPS_CONFIG.WS_BASE_URL;
    const backend = this.BACKEND_URL;
    if (backend.startsWith('https://')) {
      return backend.replace('https://', 'wss://');
    }
    if (backend.startsWith('http://')) {
      return backend.replace('http://', 'ws://');
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  },

  ENDPOINTS: {
    pilotApplications: '/api/v1/pilot/applications',
    brands: '/api/v1/brands',
    channelAudit: '/api/v1/brands/analyze-channel',
    submitJob: '/api/v1/jobs/submit',
    uploadJob: '/api/v1/jobs/upload',
    jobs: '/api/v1/jobs',
    analytics: '/api/v1/analytics/overview',
    analyticsSync: '/api/v1/analytics/sync',
    schedule: '/api/v1/schedule',
  },

  // ==========================================
  // 3. PIPELINE PRESETS & DEFAULTS
  // ==========================================
  // Keep caption controls intentionally simple while the editing API is being connected.
  SUBTITLE_PRESETS: [],
  PACING_MODES: ['snappy', 'hyper', 'natural', 'cinematic'],
  CROP_MODES: ['auto_track', 'center', 'left', 'right'],
  DEFAULT_CLIP_COUNT: 5,
};
