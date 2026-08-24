import { state } from '../state.js';
import { signOut } from '../supabase.js';

export function renderNavbar(container) {
  function update() {
    const user = state.user;
    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '';
    const accessLabel = {
      test_user: 'Test user',
      free_trial: 'Free trial',
      paid: 'Paid plan',
    }[state.userAccess?.access_type];
    const agentStatus = !user
      ? 'waiting for sign in'
      : state.userAccess?.is_active === false
        ? 'access inactive'
      : state.analytics
        ? 'using saved channel signals'
        : 'waiting for channel data';
    const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    const accountControl = user
      ? `<div class="topbar-user topbar-user-authenticated">
          <div class="topbar-avatar">${initials || 'SC'}</div>
          <span class="topbar-user-copy"><strong>${displayName || 'Your account'}</strong><small>${accessLabel || 'Workspace member'}</small></span>
          <button class="topbar-signout" id="btn-auth-logout" title="Sign out of Shoort Clips" aria-label="Sign out of Shoort Clips"><span>Sign out</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3m12-9h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"></path></svg></button>
        </div>`
      : `<button class="topbar-signin" id="btn-open-auth" type="button" aria-label="Sign in to Shoort Clips">
          <span class="topbar-signin-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6"></path></svg></span>
          <span class="topbar-signin-copy"><strong>Sign in</strong><small>Access your workspace</small></span>
          <svg class="topbar-signin-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
        </button>`;

    container.innerHTML = `
      <div class="navbar-container">
        <div class="topbar-copy"><h2>Growth workspace</h2><p>Agent status: ${agentStatus}</p></div>
        <div class="nav-actions">
          <button class="topbar-tool" id="btn-open-analytics" title="View channel analytics"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17V7m0 10h14M8 14l3-3 2 2 5-6"></path></svg><span>Analytics</span></button>
          ${accountControl}
        </div>
      </div>`;

    container.querySelector('#btn-open-analytics')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_ANALYTICS')));
    container.querySelector('#btn-open-auth')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL')));
    container.querySelector('#btn-auth-logout')?.addEventListener('click', async () => { await signOut(); state.setUser(null); });
  }

  state.subscribe((_, action) => { if (['USER_CHANGED', 'USER_ACCESS_CHANGED', 'BRANDS_UPDATED', 'ACTIVE_BRAND_CHANGED', 'ANALYTICS_UPDATED'].includes(action)) update(); });
  update();
}
