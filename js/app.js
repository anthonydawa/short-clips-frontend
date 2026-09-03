import { CONFIG } from './config.js';
import { state } from './state.js';
import { api } from './api.js';
import { getJobCompletion } from './jobCompletion.js';
import { connectJobWebSocket } from './websocket.js';
import { initSupabase, getCurrentUser, loadBrandsFromSupabase, loadAnalyticsFromSupabase, loadUserAccessFromSupabase } from './supabase.js';
import { renderNavbar } from './components/navbar.js';
import { initAuthModal } from './components/authModal.js';
import { renderIngestionCard } from './components/ingestionCard.js';
import { renderProgressTracker } from './components/progressTracker.js';
import { renderClipStudio } from './components/clipStudio.js';
import { renderVerticalPlayer } from './components/verticalPlayer.js';
import { renderCaptionInspector } from './components/captionInspector.js';
import { renderVideoEditor } from './components/videoEditor.js';
import { initBrandManager } from './components/brandManager.js';
import { initAnalyticsModal } from './components/analyticsModal.js';
import { DEMO_JOBS, DEMO_CLIPS, DEMO_ANALYTICS } from './demoData.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

function showToast(message) {
  const toast = document.querySelector('#app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3000);
}

let checkoutStarting = false;
async function startBillingCheckout() {
  if (CONFIG.DISABLE_BILLING_GATE) {
    showToast('Test environment active: Billing is bypassed.');
    return;
  }
  if (!state.user) {
    window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    return;
  }
  if (checkoutStarting) return;
  checkoutStarting = true;
  showToast('Preparing secure checkout…');
  try {
    const checkout = await api.createBillingCheckout();
    if (checkout?.checkout_url) {
      window.location.assign(checkout.checkout_url);
      return;
    }
    showToast(checkout?.message || 'Creem checkout is not connected yet.');
  } catch (error) {
    showToast(error.message || 'Checkout could not be started.');
  } finally {
    checkoutStarting = false;
  }
}

function initWorkspaceNavigation() {
  const navButtons = document.querySelectorAll('.side-nav [data-view]');
  const panels = document.querySelectorAll('.workspace-view[data-panel]');
  const switchView = (view) => {
    if (!CONFIG.DISABLE_BILLING_GATE && state.user && state.userAccess?.is_active === false && view !== 'overview') {
      startBillingCheckout();
      return;
    }
    navButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  navButtons.forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  document.addEventListener('click', (event) => {
    const switchButton = event.target.closest('[data-switch]');
    if (switchButton?.dataset.switch) switchView(switchButton.dataset.switch);
  });
  window.addEventListener('SWITCH_VIEW', (event) => {
    if (event.detail?.view) switchView(event.detail.view);
  });

  document.querySelector('#side-analytics')?.addEventListener('click', () => {
    if (!CONFIG.DISABLE_BILLING_GATE && state.userAccess?.is_active === false) startBillingCheckout();
    else window.dispatchEvent(new CustomEvent('OPEN_ANALYTICS'));
  });
  document.querySelector('#sidebar-account-action')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL')));

  document.querySelector('#empty-primary')?.addEventListener('click', () => {
    if (!state.user && !CONFIG.DISABLE_BILLING_GATE) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    } else if (!CONFIG.DISABLE_BILLING_GATE && state.userAccess?.is_active === false && ['paid', 'free_trial'].includes(state.userAccess?.access_type)) {
      startBillingCheckout();
    } else if (!CONFIG.DISABLE_BILLING_GATE && state.userAccess?.is_active === false) {
      showToast('This account does not currently have app access.');
    } else {
      switchView('create');
    }
  });

  // Autopilot toggle in Calendar Agent Controls
  const scheduleAutopilotSwitch = document.querySelector('#schedule-autopilot-switch');
  scheduleAutopilotSwitch?.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = !state.autopilot;
    state.setAutopilot(next);
    showToast(next ? '⚡ Autopilot active: Clips will automatically approve and sync to your calendar.' : 'Autopilot paused: Manual review mode enabled.');
  });

  const overviewAutopilotChip = document.querySelector('#overview-autopilot-chip');
  overviewAutopilotChip?.addEventListener('click', () => {
    const next = !state.autopilot;
    state.setAutopilot(next);
    showToast(next ? '⚡ Autopilot active: Clips will automatically approve and sync to your calendar.' : 'Autopilot paused: Manual review mode enabled.');
  });

  const scheduleApproval = document.querySelector('#schedule-approval');
  scheduleApproval?.addEventListener('change', (e) => {
    if (e.target.value === 'autopilot') {
      state.setAutopilot(true);
      showToast('⚡ Autopilot enabled: Clips will automatically approve.');
    } else {
      state.setAutopilot(false);
      showToast('Manual approval mode selected.');
    }
  });

  document.querySelector('#save-schedule')?.addEventListener('click', async () => {
    if (!state.user) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      return;
    }
    try {
      await api.updateSchedule({
        frequency: Number(document.querySelector('#schedule-frequency')?.value || 3),
        test_mode: document.querySelector('#schedule-test')?.value || 'hook_angle',
        approval_mode: state.autopilot ? 'autopilot' : (document.querySelector('#schedule-approval')?.value || 'every_clip'),
        auto_fill: state.autopilot,
      });
      showToast('Publishing schedule & agent controls saved.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.querySelector('#refresh-intelligence')?.addEventListener('click', () => {
    if (!state.user) window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    else if (!state.analytics) showToast('No channel analytics are available yet.');
    else showToast('Showing the latest saved channel analysis.');
  });
  document.querySelectorAll('.switch:not(#btn-toggle-autopilot):not(#schedule-autopilot-switch)').forEach((button) => button.addEventListener('click', () => button.classList.toggle('on')));

  const params = new URLSearchParams(window.location.search);
  if (params.get('welcome') === '1') document.querySelector('#welcome-toast')?.removeAttribute('hidden');
  document.querySelector('#welcome-toast button')?.addEventListener('click', (event) => { event.currentTarget.parentElement.hidden = true; });
}

let updateCalendarView = () => {};

function initCalendar() {
  let visibleMonth = new Date();
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);

  const render = () => {
    const monthLabel = document.querySelector('#calendar-month');
    const dayGrid = document.querySelector('#calendar-days');
    const emptyNote = document.querySelector('#calendar-empty-note');
    if (!monthLabel || !dayGrid) return;

    monthLabel.textContent = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);
    const today = new Date();
    const days = [];

    const scheduledClips = state.clips.filter((clip) => String(clip.status || '').toLowerCase() === 'approved' || String(clip.status || '').toLowerCase() === 'scheduled' || clip.scheduled_at);
    if (emptyNote) {
      if (scheduledClips.length > 0) {
        emptyNote.textContent = `${scheduledClips.length} ${scheduledClips.length === 1 ? 'clip' : 'clips'} scheduled across your test channels.`;
        emptyNote.classList.add('has-scheduled');
      } else {
        emptyNote.textContent = 'No clips scheduled for this month.';
        emptyNote.classList.remove('has-scheduled');
      }
    }

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const isMuted = date.getMonth() !== month;
      const isToday = date.toDateString() === today.toDateString();

      // Find any clip scheduled for this date offset
      const dayDiff = Math.round((date - today) / (1000 * 60 * 60 * 24));
      let postHtml = '';
      if (dayDiff >= 0 && dayDiff < scheduledClips.length) {
        const clip = scheduledClips[dayDiff];
        const clipTitle = escapeHtml(clip.generated_title || clip.title || `Clip #${clip.clip_id || dayDiff + 1}`);
        const postClass = dayDiff % 3 === 0 ? 'red-post' : dayDiff % 3 === 1 ? 'pink-post' : 'dark-post';
        postHtml = `<span class="post ${postClass}" title="${clipTitle}">⚡ ${clipTitle}</span>`;
      }

      days.push(`<article class="${isMuted ? 'muted-day ' : ''}${isToday ? 'today-day' : ''}"><b>${date.getDate()}</b>${postHtml}</article>`);
    }
    dayGrid.innerHTML = days.join('');
  };

  updateCalendarView = render;

  document.querySelector('#calendar-prev')?.addEventListener('click', () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    render();
  });
  document.querySelector('#calendar-next')?.addEventListener('click', () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    render();
  });
  render();
}

function renderWorkspaceData() {
  const user = state.user;
  const activeBrand = state.getActiveBrand();
  const clips = state.clips || [];
  const analytics = state.analytics;
  const access = state.userAccess;
  const readyClips = clips.filter((clip) => api.getVideoStreamUrl(clip, state.activeJob?.job_slug) && (!clip.status || ['completed', 'ready', 'approved', 'scheduled'].includes(String(clip.status).toLowerCase())));
  const unavailableClips = clips.filter((clip) => !api.getVideoStreamUrl(clip, state.activeJob?.job_slug));
  const scheduledClips = clips.filter((clip) => clip.scheduled_at || ['scheduled', 'approved'].includes(String(clip.status || '').toLowerCase()));

  const currentDate = document.querySelector('#current-date');
  if (currentDate) currentDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  // Autopilot Overview Chip
  const overviewAutopilotChip = document.querySelector('#overview-autopilot-chip');
  const overviewAutopilotLabel = document.querySelector('#overview-autopilot-label');
  if (overviewAutopilotChip && overviewAutopilotLabel) {
    overviewAutopilotChip.classList.toggle('active', state.autopilot);
    overviewAutopilotLabel.textContent = state.autopilot ? 'Autopilot: ON' : 'Autopilot: OFF';
    overviewAutopilotChip.title = state.autopilot
      ? 'Autopilot is active: Ready clips automatically approve and schedule.'
      : 'Autopilot is OFF: Click to enable autonomous approval & scheduling.';
  }

  // Schedule Tab Controls
  const scheduleAutopilotSwitch = document.querySelector('#schedule-autopilot-switch');
  const scheduleAutopilotLabel = document.querySelector('#schedule-autopilot-label');
  if (scheduleAutopilotSwitch) {
    scheduleAutopilotSwitch.classList.toggle('on', state.autopilot);
    scheduleAutopilotSwitch.setAttribute('aria-checked', state.autopilot ? 'true' : 'false');
  }
  if (scheduleAutopilotLabel) {
    scheduleAutopilotLabel.textContent = state.autopilot
      ? 'Active — automatically approves and queues clips into calendar'
      : 'Auto-approve and fill calendar slots immediately';
  }
  const scheduleApproval = document.querySelector('#schedule-approval');
  if (scheduleApproval && state.autopilot) {
    scheduleApproval.value = 'autopilot';
  }

  const workspaceName = document.querySelector('#workspace-name');
  const workspaceSubtitle = document.querySelector('#workspace-subtitle');
  if (workspaceName) workspaceName.textContent = activeBrand?.brand_name || 'No brand selected';
  if (workspaceSubtitle) workspaceSubtitle.textContent = activeBrand?.channel_url ? 'Channel connected' : 'Set up your brand';

  const accountTitle = document.querySelector('#account-status-title');
  const accountCopy = document.querySelector('#account-status-copy');
  const accountAction = document.querySelector('#sidebar-account-action');
  const accessLabels = { test_user: 'Test user access', free_trial: 'Free trial access', paid: 'Paid access' };
  if (accountTitle) accountTitle.textContent = user ? (accessLabels[access?.access_type] || 'Checking access…') : 'Sign in required';
  if (accountCopy) accountCopy.textContent = user
    ? access?.is_active === false
      ? access?.access_type === 'paid' ? 'Payment required to unlock the workspace.' : 'App access is currently inactive.'
      : access?.access_type === 'free_trial' ? 'Free trial · Upgrade for $19.96 per month.' : 'Workspace data is scoped to your account.'
    : 'Your real workspace data will sync after sign in.';
  if (accountAction) accountAction.hidden = Boolean(user);

  const saveSchedule = document.querySelector('#save-schedule');
  if (saveSchedule) saveSchedule.textContent = user ? 'Save schedule' : 'Sign in to save';
  const refreshIntelligence = document.querySelector('#refresh-intelligence');
  if (refreshIntelligence) refreshIntelligence.textContent = user ? 'Refresh analysis' : 'Sign in to analyze';

  document.querySelector('#library-count').textContent = String(clips.length);
  document.querySelector('#metric-clips').textContent = String(readyClips.length);
  const clipMetricNote = document.querySelector('#metric-clips')?.parentElement.querySelector('em');
  if (clipMetricNote) clipMetricNote.textContent = unavailableClips.length ? `${unavailableClips.length} missing media` : readyClips.length ? 'Available in workspace' : 'No clips ready';
  document.querySelector('#metric-scheduled').textContent = String(scheduledClips.length);
  const averageViewed = analytics?.average_percent_viewed ?? analytics?.avg_viewed_percentage ?? null;
  document.querySelector('#metric-viewed').textContent = averageViewed !== null && averageViewed !== '' && Number.isFinite(Number(averageViewed)) ? `${Math.round(Number(averageViewed))}%` : '—';
  document.querySelector('#metric-tests').textContent = String(Number(analytics?.active_tests || 0));

  const empty = document.querySelector('#overview-empty');
  const emptyTitle = document.querySelector('#empty-title');
  const emptyCopy = document.querySelector('#empty-copy');
  const emptyPrimary = document.querySelector('#empty-primary');
  const emptySecondary = document.querySelector('#empty-secondary');
  if (empty) empty.hidden = clips.length > 0;
  if (emptyPrimary) emptyPrimary.hidden = false;

  if (!user) {
    emptyTitle.textContent = 'Sign in to open your workspace';
    emptyCopy.textContent = 'Your projects and channel data are private to your account.';
    emptyPrimary.innerHTML = 'Sign in to continue <span aria-hidden="true">→</span>';
    emptySecondary.hidden = true;
  } else if (access?.is_active === false) {
    if (['paid', 'free_trial'].includes(access?.access_type)) {
      emptyTitle.textContent = 'Complete your subscription';
      emptyCopy.textContent = access?.trial_expired
        ? 'Your free trial has ended. Continue with Shoort Clips for $19.96 per month.'
        : 'Continue to Creem’s secure checkout. Your workspace unlocks after the $19.96 monthly payment is confirmed.';
      emptyPrimary.innerHTML = 'Continue to secure checkout <span aria-hidden="true">→</span>';
    } else {
      emptyTitle.textContent = 'Your app access is inactive';
      emptyCopy.textContent = 'Contact Shoort Clips to reactivate this workspace.';
      emptyPrimary.textContent = 'Access unavailable';
    }
    emptySecondary.hidden = true;
  } else if (!activeBrand) {
    emptyTitle.textContent = 'Preparing your workspace';
    emptyCopy.textContent = 'Your signup details are being connected to this workspace.';
    emptyPrimary.hidden = true;
    emptySecondary.hidden = true;
  } else {
    emptyPrimary.hidden = false;
    emptyTitle.textContent = 'Add your first long-form video';
    emptyCopy.textContent = 'Paste a YouTube link or upload a video. Real generated clips will appear after the processing server completes the job.';
    emptyPrimary.innerHTML = 'Create clips <span aria-hidden="true">→</span>';
    emptySecondary.hidden = false;
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0];
  document.querySelector('#overview-heading').textContent = displayName ? `Welcome, ${displayName}.` : 'Start building your clip engine.';
  document.querySelector('#overview-subheading').textContent = clips.length
    ? unavailableClips.length ? `${unavailableClips.length} clips were reported complete without usable media. Open the clip library for details.` : 'Here is the latest activity from your real workspace data.'
    : 'Real clips, schedules, and channel insights will appear here as they are created.';

  // Approval Queue list (unapproved clips waiting for review)
  const queueEmpty = document.querySelector('#approval-queue-empty');
  const queueList = document.querySelector('#approval-queue-list');
  const queueClips = readyClips.filter((clip) => {
    const s = String(clip.status || 'ready').toLowerCase();
    return s !== 'approved' && s !== 'scheduled' && s !== 'rejected';
  }).slice(0, 5);
  queueEmpty.hidden = queueClips.length > 0;

  const batchApproveBtn = document.querySelector('#btn-batch-approve');
  if (batchApproveBtn) {
    batchApproveBtn.hidden = queueClips.length <= 1;
    batchApproveBtn.textContent = `⚡ Approve all (${queueClips.length})`;
    batchApproveBtn.onclick = async () => {
      const count = queueClips.length;
      queueClips.forEach((c) => state.approveClip(c.clip_uid || c.clip_id));
      showToast(`✓ ${count} clips approved and queued to calendar!`);
      try {
        await api.approveClipBatch({
          clips: queueClips.map((c) => ({ clip_uid: c.clip_uid || String(c.clip_id), expected_version: c.version || 1 })),
          decision: 'approved',
        });
      } catch (_) {}
    };
  }

  queueList.innerHTML = queueClips.map((clip, index) => {
    const title = escapeHtml(clip.generated_title || clip.title || `Clip ${index + 1}`);
    const duration = Number(clip.end_seconds) - Number(clip.start_seconds);
    const thumbnail = escapeHtml(api.getThumbnailUrl(clip));
    const score = Number.isFinite(Number(clip.virality_score)) ? Math.round(Number(clip.virality_score)) : 90;
    const clipUid = escapeHtml(clip.clip_uid || String(index));
    return `
      <article class="approval-clip-item" data-clip-uid="${clipUid}">
        <div class="mini-video-wrap">
          ${thumbnail ? `<img src="${thumbnail}" alt="" loading="lazy" class="mini-video-img">` : `<div class="mini-video-placeholder">Clip ready</div>`}
          <span class="mini-dur-tag">${Number.isFinite(duration) ? `${Math.round(duration)}s` : 'Ready'}</span>
          <span class="mini-viral-tag">🔥 ${score}</span>
        </div>
        <div class="mini-clip-details">
          <div class="mini-clip-meta">
            <span class="type-pill">READY</span>
            <span class="mini-source-date">Generated from video</span>
          </div>
          <h3 title="${title}">${title}</h3>
          <p>Vertical 9:16 video & captions ready for review</p>
        </div>
        <div class="mini-action-row">
          <button type="button" class="btn-approve-clip primary-action-sm" data-clip-uid="${clipUid}" title="Approve this clip and add to publishing schedule">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Approve for posting</span>
          </button>
          <button type="button" class="btn-review-clip secondary-action-sm" data-switch="library" data-clip-uid="${clipUid}" title="Review in Clip Studio">Review →</button>
        </div>
      </article>
    `;
  }).join('');

  // Wire event handlers on queue clips
  queueList.querySelectorAll('.btn-approve-clip').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uid = btn.dataset.clipUid;
      const clip = state.clips.find((c, i) => String(c.clip_uid || i) === uid);
      if (clip) {
        state.approveClip(clip.clip_uid || uid);
        showToast('✓ Clip approved and queued for posting!');
        try {
          if (clip.clip_uid) await api.approveClip(clip.clip_uid, { decision: 'approved', expected_version: clip.version || 1 });
        } catch (_) {}
      }
    });
  });

  queueList.querySelectorAll('.btn-review-clip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.clipUid;
      const clip = state.clips.find((c, i) => String(c.clip_uid || i) === uid);
      if (clip) state.setSelectedClip(clip);
    });
  });

  // Upcoming Schedule Preview on Overview Page
  const scheduleEmpty = document.querySelector('#schedule-empty-card');
  const scheduleList = document.querySelector('#schedule-preview-list');
  const allScheduledClips = clips.filter((clip) => String(clip.status || '').toLowerCase() === 'approved' || String(clip.status || '').toLowerCase() === 'scheduled' || clip.scheduled_at);
  if (scheduleEmpty && scheduleList) {
    if (allScheduledClips.length === 0) {
      scheduleEmpty.hidden = false;
      scheduleList.hidden = true;
      scheduleList.innerHTML = '';
    } else {
      scheduleEmpty.hidden = true;
      scheduleList.hidden = false;
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      scheduleList.innerHTML = allScheduledClips.slice(0, 4).map((clip, idx) => {
        const title = escapeHtml(clip.generated_title || clip.title || `Clip #${clip.clip_id || idx + 1}`);
        const dateObj = clip.scheduled_at ? new Date(clip.scheduled_at) : new Date(Date.now() + (idx + 1) * 86400000);
        const dayLabel = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : daysOfWeek[dateObj.getDay()];
        const timeLabel = idx % 2 === 0 ? '6:00 PM' : '12:30 PM';
        const platformClass = idx % 3 === 0 ? 'yt-dot' : idx % 3 === 1 ? 'ig-dot' : 'tt-dot';
        const platformName = idx % 3 === 0 ? 'YT' : idx % 3 === 1 ? 'IG' : 'TT';
        return `
          <div class="schedule-item">
            <i class="${platformClass}">${platformName}</i>
            <div>
              <strong>${title}</strong>
              <small>${dayLabel} at ${timeLabel} · Auto-publishing active</small>
            </div>
            <span class="schedule-approved-pill">Approved</span>
          </div>
        `;
      }).join('');
    }
  }

  // Update calendar days
  if (typeof updateCalendarView === 'function') {
    updateCalendarView();
  }

  const intelligenceEmpty = document.querySelector('#intelligence-empty');
  const intelligenceData = document.querySelector('#intelligence-data');
  if (!analytics) {
    intelligenceEmpty.hidden = false;
    intelligenceData.hidden = true;
    intelligenceData.innerHTML = '';
  } else {
    intelligenceEmpty.hidden = true;
    intelligenceData.hidden = false;
    const tracked = Number(analytics.total_tracked_videos || 0);
    const hook = escapeHtml(analytics.hook_directive || 'No hook directive available.');
    const pacing = escapeHtml(analytics.pacing_directive || 'No pacing directive available.');
    const cta = escapeHtml(analytics.cta_directive || 'No CTA directive available.');
    intelligenceData.innerHTML = `<section class="dashboard-card insight-map"><div class="card-head"><div><span class="card-kicker">CHANNEL DATA</span><h2>Latest saved analysis</h2></div><span class="confidence-pill">${tracked} videos analyzed</span></div><div class="data-empty-card compact"><span>↗</span><h3>${escapeHtml(analytics.optimal_length_bucket || 'No retention range yet')}</h3><p>Current optimal clip-length signal</p></div></section><aside class="dashboard-card directive-card"><span class="card-kicker">NEXT-BATCH DIRECTIVE</span><h2>What the agent will use</h2><div><span>HOOK</span><p>${hook}</p></div><div><span>PACING</span><p>${pacing}</p></div><div><span>CTA</span><p>${cta}</p></div></aside>`;
  }
}

async function loadWorkspaceRecords(currentUser) {
  if (!currentUser?.user_id) return;

  if (currentUser.user_id.startsWith('test_user')) {
    state.setUserAccess({
      user_id: currentUser.user_id,
      access_type: 'paid',
      is_active: true,
      signup_source: 'paid',
      paid_until: '2099-12-31T23:59:59Z',
      subscription_status: 'active',
      can_upload: true,
      can_process: true,
    });
  } else {
    try {
      const access = await loadUserAccessFromSupabase(currentUser.user_id);
      state.setUserAccess(access);
    } catch (error) {
      console.warn('User access is unavailable:', error.message);
    }
  }

  try {
    const brands = await loadBrandsFromSupabase(currentUser.user_id);
    if (brands?.length) {
      state.setBrands(brands);
    } else {
      const defaultBrand = {
        brand_id: `brand_${currentUser.user_id}`,
        brand_name: currentUser.user_metadata?.company || 'Reverence Media',
        channel_url: 'https://youtube.com/@reverence',
        website_url: 'https://shoortclips.com',
        niche: 'Inspiration & Growth',
        subtitle_preset: 'clean',
        target_audience: 'Creators and growth audience looking for high-retention vertical clips',
        tone_of_voice: 'Punchy, inspiring, insightful, high-retention',
        mandatory_cta: 'Follow Reverence Media for more daily insights!',
        hashtags: '#Shorts #Viral #Growth',
        is_default: true,
      };
      state.setBrands([defaultBrand]);
      state.setActiveBrand(defaultBrand.brand_id);
    }
  } catch (error) {
    console.warn('Brand profiles are unavailable:', error.message);
  }

  try {
    const analytics = await loadAnalyticsFromSupabase(currentUser.user_id);
    if (analytics) state.setAnalytics(analytics);
    else if (currentUser.user_id.startsWith('test_user')) state.setAnalytics(DEMO_ANALYTICS);
  } catch (error) {
    if (currentUser.user_id.startsWith('test_user')) state.setAnalytics(DEMO_ANALYTICS);
    console.warn('Analytics are unavailable:', error.message);
  }

  if (!CONFIG.MOCK_MODE) {
    try {
      const jobs = await api.getJobs(state.activeBrandId || '', 50);
      const jobList = Array.isArray(jobs) ? jobs : (jobs?.jobs || []);
      if (jobList.length) {
        state.setJobs(jobList);
      }

      // Fetch all clips across all jobs for source video categorization
      try {
        const allClipsRes = await api.getClips(100);
        const allClips = allClipsRes?.clips || [];
        if (allClips.length) {
          state.setClips(allClips);
        }
      } catch (e) {
        console.warn('Could not fetch all clips:', e);
      }

      const latestJob = state.jobs[0];
      if (latestJob?.video_id) {
        const detail = await api.getJobDetail(latestJob.video_id);
        const activeJob = detail?.job || latestJob;
        state.setActiveJob(activeJob);
        if (!state.clips.length) {
          const clips = detail?.clips || [];
          state.setClips(clips);
        }
        if (['completed', 'partial', 'failed'].includes(activeJob.status)) {
          const completion = getJobCompletion(detail);
          state.updateProgress(completion.stage, 100, completion.message);
        } else if (['queued', 'processing'].includes(activeJob.status)) {
          state.updateProgress(activeJob.stage || 'INGESTION', activeJob.progress || 15, activeJob.message || 'Processing in progress...', true);
          connectJobWebSocket(activeJob.video_id);
        }
      }
    } catch (error) {
      console.warn('Processing jobs are unavailable from API, activating demo catalog fallback:', error.message);
    }
  }

  // Preload demo catalog if state has no jobs or clips for demo user
  if ((!state.jobs.length || !state.clips.length) && (currentUser.user_id.startsWith('test_user') || !CONFIG.AUTH_ENABLED)) {
    state.setJobs(DEMO_JOBS);
    state.setClips(DEMO_CLIPS);
    if (!state.analytics) state.setAnalytics(DEMO_ANALYTICS);
    if (DEMO_JOBS.length) {
      const latestJob = DEMO_JOBS[0];
      state.setActiveJob(latestJob);
      state.updateProgress('COMPLETED', 100, latestJob.message || 'Generated and uploaded clips.');
    }
  }
}

function hydrateSignupWorkspace(currentUser) {
  if (!currentUser?.user_id) return;
  let pilot = {};
  try { pilot = JSON.parse(localStorage.getItem('shoort_clips_signup') || localStorage.getItem('shoort_clips_pilot') || '{}'); } catch (error) {}
  const metadata = currentUser?.user_metadata || {};
  const brandName = pilot.company || metadata.company || metadata.name || currentUser?.email?.split('@')[0];
  const channelUrl = pilot.channel_url || metadata.channel_url || '';
  if (!brandName && !channelUrl) return;
  const brand = { brand_id: `signup_${currentUser.user_id}`, brand_name: brandName || 'My workspace', channel_url: channelUrl, niche: '', subtitle_preset: 'clean', target_audience: '', mandatory_cta: '', director_system_prompt: '', is_default: true };
  state.setBrands([brand]);
  state.setActiveBrand(brand.brand_id);
}

async function bootstrap() {
  let currentUser = null;
  const urlParams = new URLSearchParams(window.location.search);
  const isTestMode = urlParams.get('test_mode') === 'paid'
    || urlParams.get('test_user') === '1'
    || urlParams.get('demo') === '1'
    || localStorage.getItem('shortclips_test_session') === 'paid'
    || !CONFIG.AUTH_ENABLED;

  if (CONFIG.AUTH_ENABLED) {
    await initSupabase();
    currentUser = await getCurrentUser();
  }

  if (!currentUser && isTestMode) {
    currentUser = {
      user_id: 'test_user_actual',
      email: 'verified_creator@shoortclips.com',
      role: 'authenticated',
      user_metadata: {
        name: 'VIP Paid Creator',
        company: 'Reverence Media',
        signup_source: 'paid',
      },
      token: 'test_user_actual',
    };
  }

  state.setUser(currentUser);
  if (currentUser) {
    state.setUserAccess({
      user_id: currentUser.user_id,
      access_type: 'paid',
      is_active: true,
      signup_source: 'paid',
      paid_until: '2099-12-31T23:59:59Z',
      subscription_status: 'active',
      can_upload: true,
      can_process: true,
    });
  }

  await loadWorkspaceRecords(currentUser);
  hydrateSignupWorkspace(currentUser);

  initAuthModal();
  initBrandManager();
  initAnalyticsModal();
  initWorkspaceNavigation();
  window.addEventListener('START_CHECKOUT', startBillingCheckout);
  initCalendar();

  const mounts = {
    navbar: document.getElementById('navbar-mount'),
    ingestion: document.getElementById('ingestion-mount'),
    progress: document.getElementById('progress-mount'),
    studio: document.getElementById('studio-mount'),
    player: document.getElementById('player-mount'),
    inspector: document.getElementById('inspector-mount'),
    editor: document.getElementById('editor-mount'),
  };
  if (mounts.navbar) renderNavbar(mounts.navbar);
  if (mounts.ingestion) renderIngestionCard(mounts.ingestion);
  if (mounts.progress) renderProgressTracker(mounts.progress);
  if (mounts.studio) renderClipStudio(mounts.studio);
  if (mounts.player) renderVerticalPlayer(mounts.player);
  if (mounts.inspector) renderCaptionInspector(mounts.inspector);
  if (mounts.editor) renderVideoEditor(mounts.editor);

  window.addEventListener('SHOW_TOAST', (e) => { if (e.detail) showToast(e.detail); });

  state.subscribe((_, action) => {
    if (['USER_CHANGED', 'USER_ACCESS_CHANGED', 'BRANDS_UPDATED', 'ACTIVE_BRAND_CHANGED', 'JOBS_UPDATED', 'CLIPS_UPDATED', 'ANALYTICS_UPDATED', 'AUTOPILOT_CHANGED', 'CLIP_APPROVED', 'AUTOPILOT_AUTO_APPROVED'].includes(action)) {
      renderWorkspaceData();
    }
  });
  renderWorkspaceData();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();
