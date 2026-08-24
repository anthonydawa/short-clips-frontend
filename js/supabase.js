/**
 * Short Clips AI — Supabase Authentication Client
 * Real Supabase Google OAuth & Session Management
 */

import { CONFIG } from './config.js';
import { state } from './state.js';

let supabaseClient = null;

// Initialize Supabase Client dynamically
export async function initSupabase() {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('✅ Supabase Client initialized with URL:', CONFIG.SUPABASE_URL);

    // Listen to Supabase auth state changes (login, logout, token refresh)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Supabase Auth Event:', event);
      if (session?.user) {
        const user = {
          user_id: session.user.id,
          email: session.user.email,
          role: session.user.role || 'authenticated',
          user_metadata: session.user.user_metadata || {},
          token: session.access_token,
          provider_token: session.provider_token || null,
        };
        try {
          localStorage.setItem('shortclips_cloud_user', JSON.stringify(user));
        } catch (e) {}

        state.setUser(user);

        try {
          const access = await loadUserAccessFromSupabase(user.user_id);
          state.setUserAccess(access);
        } catch (e) {
          console.warn('Could not load user access:', e.message);
        }

        // Auto-rehydrate Brand Profiles from Supabase for this user
        try {
          const cloudBrands = await loadBrandsFromSupabase(user.user_id);
          if (cloudBrands && cloudBrands.length > 0) {
            state.setBrands(cloudBrands);
          }
        } catch (e) {
          console.warn('Could not auto-load cloud brands on login:', e);
        }

        // Auto-rehydrate Analytics from Supabase for this user
        try {
          const cloudAnalytics = await loadAnalyticsFromSupabase(user.user_id);
          state.setAnalytics(cloudAnalytics);
        } catch (e) {
          console.warn('Could not auto-load cloud analytics on login:', e);
        }
      } else {
        state.clearUserData();
        document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('active'));
      }
    });

    return supabaseClient;
  } catch (err) {
    console.error('⚠️ Error initializing Supabase SDK:', err);
    return null;
  }
}

/**
 * Trigger Real Google OAuth Login via Supabase
 */
export async function signInWithGoogle() {
  if (!supabaseClient) {
    await initSupabase();
  }

  if (supabaseClient) {
    console.log('🚀 Redirecting to Supabase Google OAuth...');
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      console.error('Supabase Google OAuth Error:', error);
      throw error;
    }
    return data;
  }
  throw new Error('Supabase client is not initialized.');
}

/**
 * Sign in with Email / Password
 */
export async function signInWithEmail(email, password) {
  if (!supabaseClient) await initSupabase();

  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  }
  throw new Error('Supabase client is not initialized.');
}

/**
 * Sign up with Email / Password
 */
export async function signUpWithEmail(email, password, metadata = {}) {
  if (!supabaseClient) await initSupabase();

  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    if (error) throw error;
    return data;
  }
  throw new Error('Supabase client is not initialized.');
}

/**
 * Get the current active user from Supabase session
 */
export async function getCurrentUser() {
  if (!supabaseClient) await initSupabase();

  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      return {
        user_id: session.user.id,
        email: session.user.email,
        role: session.user.role || 'authenticated',
        user_metadata: session.user.user_metadata || {},
        token: session.access_token,
      };
    }
  }

  return null;
}

/**
 * Get JWT Access Token for Backend Authorization header
 */
export async function getAccessToken() {
  if (!supabaseClient) await initSupabase();

  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }
  }
  return '';
}

/**
 * Sign Out
 */
export async function signOut() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  state.clearUserData();
  localStorage.removeItem('shortclips_cloud_user');
  localStorage.removeItem('shortclips_dev_user');
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('active'));
}

/**
 * -------------------------------------------------------------
 * CLOUD PERSISTENCE METHODS (Brand Profiles, Audits & Analytics)
 * -------------------------------------------------------------
 */

/**
 * Save / Update a Brand Profile to Supabase (cloud-first, falls back to localStorage)
 */
export async function syncBrandToSupabase(brand) {
  if (!brand) return null;
  const user = state.user;
  const userId = user?.user_id || 'dev_user';

  const row = {
    brand_id: brand.brand_id || `brand_${Date.now()}`,
    user_id: userId,
    brand_name: brand.brand_name || 'My Brand',
    channel_url: brand.channel_url || '',
    website_url: brand.website_url || '',
    niche: brand.niche || '',
    subtitle_preset: brand.subtitle_preset || 'clean',
    target_audience: brand.target_audience || '',
    tone_of_voice: brand.tone_of_voice || '',
    forbidden_words: brand.forbidden_words || '',
    mandatory_cta: brand.mandatory_cta || '',
    hashtags: brand.hashtags || '',
    director_system_prompt: brand.director_system_prompt || '',
    raw_profile_json: brand,
    is_default: brand.is_default ? true : false,
    updated_at: new Date().toISOString(),
  };

  // 1. Try syncing to Supabase if connected
  if (supabaseClient && user?.user_id && user.user_id !== 'dev_user') {
    try {
      const { data, error } = await supabaseClient
        .from('brand_profiles')
        .upsert(row, { onConflict: 'brand_id' })
        .select();

      if (error) {
        console.warn('Supabase brand_profiles sync notice:', error.message);
      } else {
        console.log('☁️ Synced brand to Supabase:', row.brand_name);
      }
    } catch (err) {
      console.warn('Supabase brand sync error (fallback to local):', err.message);
    }
  }

  // 2. Always persist to localStorage for offline cache
  try {
    const key = `shortclips_brands_${userId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = stored.findIndex((b) => b.brand_id === row.brand_id);
    if (idx >= 0) {
      stored[idx] = { ...stored[idx], ...row };
    } else {
      stored.unshift(row);
    }
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (e) {
    console.warn('Could not cache brand locally:', e);
  }

  return row;
}

/**
 * Load all Brand Profiles for a user from Supabase (merging cloud & cached profiles)
 */
export async function loadBrandsFromSupabase(userId) {
  if (!userId) return [];

  let cloudBrands = [];

  // 1. Fetch from Supabase
  if (supabaseClient && userId !== 'dev_user') {
    try {
      const { data, error } = await supabaseClient
        .from('brand_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        cloudBrands = data.map((b) => ({
          ...b,
          ...(b.raw_profile_json || {}),
          brand_id: b.brand_id,
          brand_name: b.brand_name,
        }));
        console.log(`☁️ Loaded ${cloudBrands.length} brands from Supabase.`);
      }
    } catch (err) {
      console.warn('Could not fetch cloud brands from Supabase:', err.message);
    }
  }

  // 2. If cloud has records, refresh local cache
  const key = `shortclips_brands_${userId}`;
  if (cloudBrands.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(cloudBrands));
    } catch (e) {}
    return cloudBrands;
  }

  // Authenticated workspaces use Supabase as the source of truth. A missing
  // cloud row must stay empty instead of reviving stale development data.
  if (userId !== 'dev_user') return [];

  // Local-only development profile fallback.
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  return [];
}

/**
 * Save a Channel Audit snapshot to Supabase
 */
export async function syncAuditToSupabase(auditData, channelUrl, contextNote = '') {
  if (!auditData) return null;
  const user = state.user;
  const userId = user?.user_id || 'dev_user';

  const auditRecord = {
    audit_id: `audit_${Date.now()}`,
    user_id: userId,
    channel_url: channelUrl || '',
    context_note: contextNote || '',
    audit_data: auditData,
    created_at: new Date().toISOString(),
  };

  if (supabaseClient && user?.user_id && user.user_id !== 'dev_user') {
    try {
      const { error } = await supabaseClient
        .from('channel_audits')
        .insert(auditRecord);

      if (error) {
        console.warn('Supabase channel_audits sync notice:', error.message);
      } else {
        console.log('☁️ Synced audit to Supabase for:', channelUrl);
      }
    } catch (err) {
      console.warn('Supabase audit sync exception:', err.message);
    }
  }

  // Cache locally
  try {
    const key = `shortclips_audits_${userId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    stored.unshift(auditRecord);
    localStorage.setItem(key, JSON.stringify(stored.slice(0, 20)));
  } catch (e) {}

  return auditRecord;
}

/**
 * Save Channel Intelligence & Analytics Directives to Supabase
 */
export async function syncAnalyticsToSupabase(analyticsOverview, ytProfile = null) {
  if (!analyticsOverview) return;
  const user = state.user;
  const userId = user?.user_id || 'dev_user';

  const record = {
    user_id: userId,
    total_tracked_videos: analyticsOverview.total_tracked_videos || 0,
    optimal_length_bucket: analyticsOverview.optimal_length_bucket || '20-45s',
    target_duration_min_seconds: analyticsOverview.target_duration_min_seconds || 20,
    target_duration_max_seconds: analyticsOverview.target_duration_max_seconds || 45,
    hook_directive: analyticsOverview.hook_directive || '',
    pacing_directive: analyticsOverview.pacing_directive || '',
    cta_directive: analyticsOverview.cta_directive || '',
    channel_handle: ytProfile?.channel_handle || '',
    channel_title: ytProfile?.channel_title || '',
    channel_avatar: ytProfile?.channel_avatar || '',
    diagnostics_json: analyticsOverview,
    updated_at: new Date().toISOString(),
  };

  if (supabaseClient && user?.user_id && user.user_id !== 'dev_user') {
    try {
      const { error } = await supabaseClient
        .from('user_analytics')
        .upsert(record, { onConflict: 'user_id' });

      if (error) {
        console.warn('Supabase user_analytics sync notice:', error.message);
      } else {
        console.log('☁️ Synced user analytics to Supabase.');
      }
    } catch (err) {
      console.warn('Supabase analytics sync error:', err.message);
    }
  }

  // Cache locally
  try {
    localStorage.setItem(`shortclips_analytics_${userId}`, JSON.stringify(record));
  } catch (e) {}

  return record;
}

/**
 * Load Analytics Snapshots & Directives from Supabase
 */
export async function loadAnalyticsFromSupabase(userId) {
  if (!userId) return null;

  if (supabaseClient && userId !== 'dev_user') {
    try {
      const { data, error } = await supabaseClient
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        console.log('☁️ Loaded analytics directives from Supabase.');
        return data;
      }
    } catch (err) {
      console.warn('Could not fetch cloud analytics:', err.message);
    }
  }

  // Authenticated workspaces use Supabase as the source of truth.
  if (userId !== 'dev_user') return null;

  // Local-only development profile fallback.
  try {
    const cached = localStorage.getItem(`shortclips_analytics_${userId}`);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return null;
}

/**
 * Load the server-controlled access row for the signed-in user.
 * Until the user_access setup SQL is applied, authenticated users retain the
 * temporary test access requested for this development phase.
 */
export async function loadUserAccessFromSupabase(userId) {
  if (!userId) return null;

  if (supabaseClient && userId !== 'dev_user') {
    const { data, error } = await supabaseClient
      .from('user_access')
      .select('user_id, access_type, is_active, signup_source, trial_ends_at, paid_until, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) return data;

    if (error) {
      console.warn('Supabase user_access is not available yet:', error.message);
    }
  }

  return {
    user_id: userId,
    access_type: 'test_user',
    is_active: true,
    signup_source: 'direct',
    temporary_default: true,
  };
}
