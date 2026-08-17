import { api } from '../api.js';
import { state } from '../state.js';
import { syncAnalyticsToSupabase, loadAnalyticsFromSupabase } from '../supabase.js';

export function initAnalyticsModal() {
  const modalEl = document.getElementById('analytics-modal');
  if (!modalEl) return;

  async function render() {
    let currentYtProfile = null;
    try {
      const ytStatus = await api.getYouTubeStatus();
      if (ytStatus && ytStatus.connected) {
        currentYtProfile = ytStatus;
      }
    } catch (e) {
      console.warn('Could not check YouTube status:', e);
    }

    const isConnected = !!currentYtProfile?.connected;
    const channelTitle = currentYtProfile?.channel_title || 'YouTube Channel Analytics';
    const channelHandle = currentYtProfile?.channel_handle ? ` (${currentYtProfile.channel_handle})` : '';
    const subsCount = currentYtProfile?.subscribers !== undefined ? parseInt(currentYtProfile.subscribers, 10) : 0;
    const subsText = isConnected ? ` • ${subsCount.toLocaleString()} Subscribers` : '';
    const avatarUrl = currentYtProfile?.channel_avatar || '';

    modalEl.innerHTML = `
      <div class="modal-card" style="max-width: 760px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="logo-icon" style="width: 32px; height: 32px; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <h3 style="font-size: 20px;">Channel Intelligence & Diagnostics</h3>
          </div>
          <button id="btn-close-analytics-modal" class="btn btn-ghost btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- YouTube 1-Click Channel Connection Banner -->
        <div id="yt-connect-banner" style="background: rgba(11, 17, 33, 0.8); border: 1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-glass-glow)'}; border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div id="yt-avatar-wrap" style="width: 44px; height: 44px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: ${isConnected ? '0 0 14px rgba(16, 185, 129, 0.35)' : '0 0 12px rgba(239, 68, 68, 0.4)'}; border: 2px solid ${isConnected ? '#10b981' : 'transparent'}; flex-shrink: 0;">
              ${avatarUrl 
                ? `<img src="${avatarUrl}" alt="${channelTitle}" style="width: 100%; height: 100%; object-fit: cover;" referrerpolicy="no-referrer">` 
                : `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>`}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;" id="yt-status-title">
                ${channelTitle}
                ${isConnected ? `<span class="badge badge-emerald" style="font-size: 10px; font-weight: 700;">Connected</span>` : ''}
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;" id="yt-status-desc">
                ${isConnected 
                  ? `${channelHandle}${subsText} • Authorized for Live Analytics & Directing AI` 
                  : 'Connect once to sync live views, retention curves, and engagement rates'}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;" id="yt-btn-actions">
            ${isConnected ? `
              <button id="btn-sync-yt" class="btn btn-secondary btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Sync Now
              </button>
              <button id="btn-disconnect-yt" class="btn btn-ghost btn-sm" style="color: #f87171;" title="Disconnect Channel">
                Disconnect
              </button>
            ` : `
              <button id="btn-connect-yt" class="btn btn-primary btn-sm">
                🔗 Connect YouTube Channel
              </button>
            `}
          </div>
        </div>

        <div id="analytics-content" style="padding: 10px 0;">
          <div style="text-align: center; color: var(--text-muted); padding: 20px;">
            <span class="anim-spin" style="display: inline-block; margin-bottom: 8px;">⚡</span>
            <div>Loading analytics diagnostics...</div>
          </div>
        </div>
      </div>
    `;

    modalEl.querySelector('#btn-close-analytics-modal').addEventListener('click', () => {
      modalEl.classList.remove('active');
    });

    const ytConnectBtn = modalEl.querySelector('#btn-connect-yt');
    const ytSyncBtn = modalEl.querySelector('#btn-sync-yt');
    const ytDisconnectBtn = modalEl.querySelector('#btn-disconnect-yt');

    if (ytConnectBtn) {
      ytConnectBtn.addEventListener('click', () => {
        const user = state.user;
        api.connectYouTubeChannel(user?.user_id || '');
      });
    }

    if (ytDisconnectBtn) {
      ytDisconnectBtn.addEventListener('click', async () => {
        if (confirm('Do you want to disconnect this YouTube channel?')) {
          await api.disconnectYouTubeChannel();
          render();
        }
      });
    }

    if (ytSyncBtn) {
      ytSyncBtn.addEventListener('click', async () => {
        ytSyncBtn.disabled = true;
        ytSyncBtn.innerHTML = '⏳ Syncing...';
        try {
          const res = await api.syncAnalytics();
          const freshOverview = await api.getAnalyticsOverview();
          await syncAnalyticsToSupabase(freshOverview, currentYtProfile);
          alert(res.message || 'Synced successfully to your profile!');
          render();
        } catch (err) {
          alert('Sync Error: ' + err.message);
        } finally {
          if (ytSyncBtn) {
            ytSyncBtn.disabled = false;
            ytSyncBtn.innerHTML = 'Sync Now';
          }
        }
      });
    }

    const contentEl = modalEl.querySelector('#analytics-content');
    try {
      let data = null;
      try {
        data = await api.getAnalyticsOverview();
      } catch (e) {
        console.warn('Backend analytics overview not available, checking user cloud profile:', e);
      }

      const user = state.user;
      if ((!data || !data.total_tracked_videos) && user?.user_id) {
        const cloudAnalytics = await loadAnalyticsFromSupabase(user.user_id);
        if (cloudAnalytics) {
          data = cloudAnalytics;
        }
      }

      const totalVideos = data?.total_tracked_videos || 0;
      const lengthBucket = data?.optimal_length_bucket && data.optimal_length_bucket !== '—'
        ? data.optimal_length_bucket 
        : (isConnected ? '20-45s' : '—');

      const durationMin = data?.target_duration_min_seconds || (isConnected ? 20 : 0);
      const durationMax = data?.target_duration_max_seconds || (isConnected ? 45 : 0);
      const durationRange = (durationMin && durationMax) 
        ? `${durationMin}s - ${durationMax}s` 
        : (isConnected ? '20s - 45s' : '—');

      const hookDirective = data?.hook_directive && totalVideos > 0
        ? data.hook_directive
        : (isConnected 
            ? 'Open immediately with a high-velocity hook in the first 2 seconds.' 
            : 'Connect your channel or sync metrics to generate customized hook strategies.');

      const pacingDirective = data?.pacing_directive && totalVideos > 0
        ? data.pacing_directive
        : (isConnected 
            ? 'Preserve back for complete payoff; trim front lead-in.' 
            : 'Directing flow adapts automatically to audience retention patterns.');

      const ctaDirective = data?.cta_directive && totalVideos > 0
        ? data.cta_directive
        : (isConnected 
            ? 'Include 3-4 targeted hashtags and CTA anchor for your channel.' 
            : 'Tailored call-to-action anchors based on your high-converting videos.');

      if (totalVideos > 0 && user?.user_id) {
        syncAnalyticsToSupabase(data, currentYtProfile).catch(() => {});
      }

      contentEl.innerHTML = `
        <!-- Metrics Grid -->
        <div class="grid-3col" style="gap: 16px; margin-bottom: 24px;">
          <div style="background: rgba(11, 17, 33, 0.7); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 800; font-family: var(--font-display); color: #ffffff;">${totalVideos}</div>
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-top: 4px;">Videos Analyzed</div>
          </div>
          <div style="background: rgba(11, 17, 33, 0.7); border: 1px solid rgba(250, 204, 21, 0.3); border-radius: var(--radius-md); padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 800; font-family: var(--font-display); color: var(--accent-yellow);">${lengthBucket}</div>
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-top: 4px;">Optimal Retention Bucket</div>
          </div>
          <div style="background: rgba(11, 17, 33, 0.7); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 800; font-family: var(--font-display); color: var(--accent-cyan);">${durationRange}</div>
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-top: 4px;">Target Clip Duration</div>
          </div>
        </div>

        <!-- AI Directives -->
        <div style="background: rgba(11, 17, 33, 0.6); border: 1px solid var(--border-glass-glow); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">🎯 High-Retention Hook Strategy</div>
            <div style="font-size: 13px; color: var(--text-primary);">${hookDirective}</div>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--accent-yellow); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">⚡ Pacing & Editing Flow</div>
            <div style="font-size: 13px; color: var(--text-primary);">${pacingDirective}</div>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--accent-emerald); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📣 Call To Action & Hashtags</div>
            <div style="font-size: 13px; color: var(--text-primary);">${ctaDirective}</div>
          </div>
        </div>
      `;
    } catch (err) {
      contentEl.innerHTML = `<div style="color: var(--accent-rose); padding: 16px;">Failed to load analytics: ${err.message}</div>`;
    }
  }

  window.addEventListener('OPEN_ANALYTICS', () => {
    if (!state.user) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      return;
    }
    render();
    modalEl.classList.add('active');
  });
}
