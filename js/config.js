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
  // When running locally on your machine, this points to localhost:8000.
  // When deployed to production (Hostinger, Cloudflare Pages, etc.),
  // change the production URL to your Google Cloud Run or VPS API domain.
  get BACKEND_URL() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname === '';
    
    if (isLocal) {
      return 'http://localhost:8000';
    }

    // 🚀 PRODUCTION BACKEND URL
    // Replace with your Google Cloud Run service URL or custom domain:
    // e.g. 'https://shortclips-api-xyz-uc.a.run.app' or 'https://api.yourdomain.com'
    return 'https://api.yourdomain.com';
  },

  // WebSocket Base URL (Automatically converts http/https to ws/wss)
  get WS_BASE_URL() {
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

  // ==========================================
  // 3. PIPELINE PRESETS & DEFAULTS
  // ==========================================
  SUBTITLE_PRESETS: ['hormozi', 'clean', 'tech', 'beast'],
  PACING_MODES: ['snappy', 'hyper', 'natural', 'cinematic'],
  CROP_MODES: ['auto_track', 'center', 'left', 'right'],
  DEFAULT_CLIP_COUNT: 5,
};
