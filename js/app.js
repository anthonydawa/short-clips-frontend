import { CONFIG } from './config.js';
import { state } from './state.js';
import { api } from './api.js';
import { initSupabase, getCurrentUser, loadBrandsFromSupabase, loadAnalyticsFromSupabase, loadUserAccessFromSupabase } from './supabase.js';
import { renderNavbar } from './components/navbar.js';
import { initAuthModal } from './components/authModal.js';
import { renderIngestionCard } from './components/ingestionCard.js';
import { renderProgressTracker } from './components/progressTracker.js';
import { renderClipStudio } from './components/clipStudio.js';
import { renderVerticalPlayer } from './components/verticalPlayer.js';
import { renderCaptionInspector } from './components/captionInspector.js';
import { initBrandManager } from './components/brandManager.js';
import { initAnalyticsModal } from './components/analyticsModal.js';

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

function initWorkspaceNavigation() {
  const navButtons = document.querySelectorAll('.side-nav [data-view]');
  const panels = document.querySelectorAll('.workspace-view[data-panel]');
  const switchView = (view) => {
    navButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  navButtons.forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  document.addEventListener('click', (event) => {
    const switchButton = event.target.closest('[data-switch]');
    if (switchButton?.dataset.switch) switchView(switchButton.dataset.switch);
  });

  document.querySelector('#side-brand')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER')));
  document.querySelector('#workspace-brand-button')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER')));
  document.querySelector('#side-audit')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_CHANNEL_AUDITOR')));
  document.querySelector('#start-channel-audit')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_CHANNEL_AUDITOR')));
  document.querySelector('#side-analytics')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_ANALYTICS')));
  document.querySelector('#sidebar-account-action')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL')));

  document.querySelector('#empty-primary')?.addEventListener('click', () => {
    if (!state.user) window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    else if (state.userAccess?.is_active === false) showToast('This account does not currently have app access.');
    else if (!state.getActiveBrand()) window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER'));
    else switchView('create');
  });

  document.querySelector('#empty-secondary')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER')));
  document.querySelector('#save-schedule')?.addEventListener('click', async () => {
    if (!state.user) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      return;
    }
    try {
      await api.updateSchedule({
        frequency: Number(document.querySelector('#schedule-frequency')?.value || 3),
        test_mode: document.querySelector('#schedule-test')?.value || 'hook_angle',
        approval_mode: document.querySelector('#schedule-approval')?.value || 'every_clip',
      });
      showToast('Schedule saved.');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.querySelector('#refresh-intelligence')?.addEventListener('click', () => {
    if (!state.user) window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    else if (!state.analytics) showToast('No channel analytics are available yet.');
    else showToast('Showing the latest saved channel analysis.');
  });
  document.querySelectorAll('.switch').forEach((button) => button.addEventListener('click', () => button.classList.toggle('on')));

  const params = new URLSearchParams(window.location.search);
  if (params.get('welcome') === '1') document.querySelector('#welcome-toast')?.removeAttribute('hidden');
  document.querySelector('#welcome-toast button')?.addEventListener('click', (event) => { event.currentTarget.parentElement.hidden = true; });
}

function initCalendar() {
  let visibleMonth = new Date();
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);

  const render = () => {
    const monthLabel = document.querySelector('#calendar-month');
    const dayGrid = document.querySelector('#calendar-days');
    if (!monthLabel || !dayGrid) return;

    monthLabel.textContent = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);
    const today = new Date();
    const days = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const isMuted = date.getMonth() !== month;
      const isToday = date.toDateString() === today.toDateString();
      days.push(`<article class="${isMuted ? 'muted-day ' : ''}${isToday ? 'today-day' : ''}"><b>${date.getDate()}</b></article>`);
    }
    dayGrid.innerHTML = days.join('');
  };

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
  const readyClips = clips.filter((clip) => !clip.status || ['completed', 'ready', 'approved'].includes(String(clip.status).toLowerCase()));
  const scheduledClips = clips.filter((clip) => clip.scheduled_at || String(clip.status).toLowerCase() === 'scheduled');

  const currentDate = document.querySelector('#current-date');
  if (currentDate) currentDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

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
      ? 'App access is currently inactive.'
      : 'Workspace data is scoped to your account.'
    : 'Your real workspace data will sync after sign in.';
  if (accountAction) accountAction.hidden = Boolean(user);

  const saveSchedule = document.querySelector('#save-schedule');
  if (saveSchedule) saveSchedule.textContent = user ? 'Save schedule' : 'Sign in to save';
  const refreshIntelligence = document.querySelector('#refresh-intelligence');
  if (refreshIntelligence) refreshIntelligence.textContent = user ? 'Refresh analysis' : 'Sign in to analyze';

  document.querySelector('#library-count').textContent = String(clips.length);
  document.querySelector('#metric-clips').textContent = String(readyClips.length);
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

  if (!user) {
    emptyTitle.textContent = 'Sign in to open your workspace';
    emptyCopy.textContent = 'Your projects and channel data are private to your account.';
    emptyPrimary.innerHTML = 'Sign in to continue <span aria-hidden="true">→</span>';
    emptySecondary.hidden = true;
  } else if (access?.is_active === false) {
    emptyTitle.textContent = 'Your app access is inactive';
    emptyCopy.textContent = 'Contact Shoort Clips to activate a free trial, paid plan, or test account.';
    emptyPrimary.textContent = 'Access unavailable';
    emptySecondary.hidden = true;
  } else if (!activeBrand) {
    emptyTitle.textContent = 'Set up your first brand';
    emptyCopy.textContent = 'Add your channel, audience, voice, and clip style so the agent knows what to optimize.';
    emptyPrimary.innerHTML = 'Create brand profile <span aria-hidden="true">→</span>';
    emptySecondary.hidden = true;
  } else {
    emptyTitle.textContent = 'Add your first long-form video';
    emptyCopy.textContent = 'Paste a YouTube link or upload a video. Real generated clips will appear after the processing server completes the job.';
    emptyPrimary.innerHTML = 'Create clips <span aria-hidden="true">→</span>';
    emptySecondary.hidden = false;
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0];
  document.querySelector('#overview-heading').textContent = displayName ? `Welcome, ${displayName}.` : 'Start building your clip engine.';
  document.querySelector('#overview-subheading').textContent = clips.length
    ? 'Here is the latest activity from your real workspace data.'
    : 'Real clips, schedules, and channel insights will appear here as they are created.';

  const queueEmpty = document.querySelector('#approval-queue-empty');
  const queueList = document.querySelector('#approval-queue-list');
  const queueClips = readyClips.filter((clip) => String(clip.status || 'ready').toLowerCase() !== 'approved').slice(0, 3);
  queueEmpty.hidden = queueClips.length > 0;
  queueList.innerHTML = queueClips.map((clip, index) => {
    const title = escapeHtml(clip.generated_title || clip.title || `Clip ${index + 1}`);
    const duration = Number(clip.end_seconds) - Number(clip.start_seconds);
    return `<article><div class="mini-video video-dark"><span>${Number.isFinite(duration) ? `${Math.round(duration)}s` : 'Ready'}</span></div><div><span class="type-pill">READY</span><h3>${title}</h3><p>Generated from your video</p><button data-switch="library">Review clip</button></div></article>`;
  }).join('');

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

  try {
    const access = await loadUserAccessFromSupabase(currentUser.user_id);
    state.setUserAccess(access);
  } catch (error) {
    console.warn('User access is unavailable:', error.message);
  }

  try {
    const brands = await loadBrandsFromSupabase(currentUser.user_id);
    if (brands?.length) state.setBrands(brands);
  } catch (error) {
    console.warn('Brand profiles are unavailable:', error.message);
  }

  try {
    const analytics = await loadAnalyticsFromSupabase(currentUser.user_id);
    if (analytics) state.setAnalytics(analytics);
  } catch (error) {
    console.warn('Analytics are unavailable:', error.message);
  }

  if (CONFIG.MOCK_MODE) return;
  try {
    const jobs = await api.getJobs(state.activeBrandId || '', 50);
    state.setJobs(Array.isArray(jobs) ? jobs : jobs?.jobs || []);
    const latestJob = state.jobs[0];
    if (latestJob?.video_id) {
      const detail = await api.getJobDetail(latestJob.video_id);
      state.setActiveJob(detail?.job || latestJob);
      state.setClips(detail?.clips || []);
    }
  } catch (error) {
    console.warn('Processing jobs are unavailable:', error.message);
  }
}

async function bootstrap() {
  let currentUser = null;
  if (CONFIG.AUTH_ENABLED) {
    await initSupabase();
    currentUser = await getCurrentUser();
  }
  state.setUser(currentUser);

  initAuthModal();
  initBrandManager();
  initAnalyticsModal();
  initWorkspaceNavigation();
  initCalendar();

  const mounts = {
    navbar: document.getElementById('navbar-mount'),
    ingestion: document.getElementById('ingestion-mount'),
    progress: document.getElementById('progress-mount'),
    studio: document.getElementById('studio-mount'),
    player: document.getElementById('player-mount'),
    inspector: document.getElementById('inspector-mount'),
  };
  if (mounts.navbar) renderNavbar(mounts.navbar);
  if (mounts.ingestion) renderIngestionCard(mounts.ingestion);
  if (mounts.progress) renderProgressTracker(mounts.progress);
  if (mounts.studio) renderClipStudio(mounts.studio);
  if (mounts.player) renderVerticalPlayer(mounts.player);
  if (mounts.inspector) renderCaptionInspector(mounts.inspector);

  state.subscribe((_, action) => {
    if (['USER_CHANGED', 'USER_ACCESS_CHANGED', 'BRANDS_UPDATED', 'ACTIVE_BRAND_CHANGED', 'JOBS_UPDATED', 'CLIPS_UPDATED', 'ANALYTICS_UPDATED'].includes(action)) renderWorkspaceData();
  });
  renderWorkspaceData();
  await loadWorkspaceRecords(currentUser);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();
