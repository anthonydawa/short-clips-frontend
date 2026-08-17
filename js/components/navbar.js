/**
 * Short Clips AI — Navbar Component
 */

import { state } from '../state.js';
import { signOut } from '../supabase.js';

export function renderNavbar(container) {
  function update() {
    const user = state.user;
    const brands = state.brands;
    const activeBrandId = state.activeBrandId;

    const brandOptions = brands.length > 0
      ? brands.map((b) => `<option value="${b.brand_id}" ${b.brand_id === activeBrandId ? 'selected' : ''}>${b.brand_name}</option>`).join('')
      : '<option value="">Default Brand</option>';

    const avatarUrl = user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
    const userName = user?.user_metadata?.name || user?.email || 'Creator';

    container.innerHTML = `
      <div class="navbar-container">
        <!-- Brand Logo -->
        <div class="brand-logo" id="nav-logo">
          <div class="logo-icon anim-pulse">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <div>
            <div class="brand-title">Short Clips <span class="gradient-text">AI</span></div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); letter-spacing: 0.05em;">CREATOR STUDIO</div>
          </div>
        </div>

        <!-- Navigation Actions -->
        <div class="nav-actions">
          ${
            user
              ? `
            <!-- Single Brand Profile Button -->
            <button id="btn-open-brands" class="btn btn-secondary btn-sm" title="Edit Brand Profile & Presets" style="gap: 8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span id="nav-brand-label" style="font-weight: 700;">${state.getActiveBrand()?.brand_name || 'Brand Profile'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>

            <!-- Channel Auditor Quick Button -->
            <button id="btn-quick-auditor" class="btn btn-secondary btn-sm" title="AI YouTube Channel Auditor">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Audit Channel
            </button>

            <!-- Analytics Button -->
            <button id="btn-open-analytics" class="btn btn-ghost btn-sm" title="Analytics & Benchmarks">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Analytics
            </button>

            <!-- Supabase Auth / User Button -->
            <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
              <img src="${avatarUrl}" alt="${userName}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover;">
              <span style="font-size: 13px; font-weight: 600;">${userName}</span>
              <button id="btn-auth-logout" class="btn btn-ghost btn-icon btn-sm" title="Sign Out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          `
              : `
            <button id="btn-open-auth" class="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.25-.93 2.3-1.99 3.02v2.51h3.22c1.88-1.73 2.97-4.28 2.97-7.24 0-.43-.04-.86-.1-1.27z"/>
                <path d="M12.18 21c2.7 0 4.96-.9 6.61-2.43l-3.22-2.51c-.89.6-2.03.96-3.39.96-2.61 0-4.81-1.76-5.6-4.13H3.25v2.59C4.89 18.73 8.27 21 12.18 21z"/>
                <path d="M6.58 12.89c-.2-.6-.31-1.25-.31-1.89s.11-1.29.31-1.89V6.52H3.25C2.58 7.86 2.18 9.39 2.18 11s.4 3.14 1.07 4.48l3.33-2.59z"/>
                <path d="M12.18 5.08c1.47 0 2.78.51 3.82 1.5l2.86-2.86C17.13 2.1 14.88 1.18 12.18 1.18 8.27 1.18 4.89 3.45 3.25 6.52l3.33 2.59c.79-2.37 2.99-4.13 5.6-4.13z"/>
              </svg>
              Sign In
            </button>
          `
          }
        </div>
      </div>
    `;

    // Attach event listeners
    const btnOpenBrands = container.querySelector('#btn-open-brands');
    if (btnOpenBrands) {
      btnOpenBrands.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER'));
      });
    }

    const btnQuickAuditor = container.querySelector('#btn-quick-auditor');
    if (btnQuickAuditor) {
      btnQuickAuditor.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('OPEN_CHANNEL_AUDITOR'));
      });
    }

    const btnOpenAnalytics = container.querySelector('#btn-open-analytics');
    if (btnOpenAnalytics) {
      btnOpenAnalytics.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('OPEN_ANALYTICS'));
      });
    }

    const btnOpenAuth = container.querySelector('#btn-open-auth');
    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      });
    }

    const btnAuthLogout = container.querySelector('#btn-auth-logout');
    if (btnAuthLogout) {
      btnAuthLogout.addEventListener('click', async () => {
        await signOut();
        state.setUser(null);
      });
    }
  }

  // Subscribe to state updates
  state.subscribe((currentState, action) => {
    if (['USER_CHANGED', 'BRANDS_UPDATED', 'ACTIVE_BRAND_CHANGED'].includes(action)) {
      update();
    }
  });

  update();
}
