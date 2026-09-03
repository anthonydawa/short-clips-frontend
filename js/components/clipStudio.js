import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../media.js';
import { renderCaptionInspector } from './captionInspector.js';

let activeSourceVideo = 'all'; // 'all' | specific video_id
let activeViralityFilter = 'all'; // 'all' | 'viral' | 'short' | 'standard'

export function renderClipStudio(container) {
  function formatTime(secs) {
    if (isNaN(secs) || !Number.isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function formatStamp(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  function openInspectorModal(clip) {
    const modal = document.getElementById('clip-inspector-modal');
    if (!modal) return;
    state.setSelectedClip(clip);
    modal.classList.add('active');
    modal.innerHTML = `
      <div class="modal-card studio-modal-card" style="max-width: 680px; position: relative;">
        <button type="button" class="modal-close-btn" id="btn-close-insp-modal" aria-label="Close" style="position: absolute; right: 16px; top: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #888;">×</button>
        <div id="modal-inspector-mount"></div>
      </div>
    `;
    const mount = modal.querySelector('#modal-inspector-mount');
    if (mount) renderCaptionInspector(mount);
    modal.querySelector('#btn-close-insp-modal')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  function update() {
    const clips = state.clips || [];
    const jobs = state.jobs || [];
    const activeJob = state.activeJob;

    if (!clips.length) {
      container.innerHTML = `
        <div class="studio-section">
          <div class="data-empty-card library-empty">
            <span>▦</span>
            <h2>Your clip library is empty</h2>
            <p>When the processing server returns completed clips for your account, they will appear here automatically.</p>
            <button data-switch="create" class="brief-primary">Add a long-form video →</button>
          </div>
        </div>`;
      return;
    }

    // Build map of Jobs for rich source metadata
    const jobMap = {};
    jobs.forEach((j) => { jobMap[j.video_id] = j; });

    // Group clips by source video (video_id)
    const clipsByVideo = {};
    clips.forEach((clip) => {
      const vId = clip.video_id || activeJob?.video_id || 'default_video';
      if (!clipsByVideo[vId]) clipsByVideo[vId] = [];
      clipsByVideo[vId].push(clip);
    });

    const videoIds = Object.keys(clipsByVideo);

    // Apply active source filter
    const visibleVideoIds = activeSourceVideo === 'all'
      ? videoIds
      : videoIds.filter((vId) => vId === activeSourceVideo);

    // Filter helper
    const matchesVirality = (clip) => {
      const dur = Number(clip.end_seconds || 0) - Number(clip.start_seconds || 0);
      const score = Number(clip.virality_score || 0);
      if (activeViralityFilter === 'viral') return score >= 90;
      if (activeViralityFilter === 'short') return dur < 30;
      if (activeViralityFilter === 'standard') return dur >= 30;
      return true;
    };

    // Render Video Section HTML
    const sectionsHtml = visibleVideoIds.map((vId) => {
      const videoClips = clipsByVideo[vId] || [];
      const filteredVideoClips = videoClips.filter(matchesVirality);
      const jobInfo = jobMap[vId] || (vId === activeJob?.video_id ? activeJob : null);
      
      const rawTitle = jobInfo?.source_title || (jobInfo?.source_url ? 'YouTube: ' + jobInfo.source_url.split('&')[0].replace('https://www.youtube.com/watch?v=', '') : `Source Video (${vId})`);
      const sourceTitle = escapeHtml(rawTitle);
      const createdDate = jobInfo?.created_at ? new Date(jobInfo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently Processed';

      const cardsHtml = filteredVideoClips.map((clip) => {
        const originalIndex = clips.indexOf(clip);
        const start = Number(clip.start_seconds || 0);
        const end = Number(clip.end_seconds || 0);
        const durationSec = end > start ? (end - start) : 30.0;
        const duration = `${durationSec.toFixed(1)}s`;
        const score = Number.isFinite(Number(clip.virality_score)) ? Math.round(Number(clip.virality_score)) : 90;
        const title = escapeHtml(clip.generated_title || clip.title || `Clip #${clip.clip_id ?? originalIndex + 1}`);
        const caption = clip.caption || '';
        const isApproved = String(clip.status || '').toLowerCase() === 'approved' || String(clip.status || '').toLowerCase() === 'scheduled';
        const videoSrc = escapeHtml(api.getVideoStreamUrl(clip, jobInfo?.job_slug || activeJob?.job_slug));
        const subSrc = escapeHtml(api.getSubtitleStreamUrl(clip, jobInfo?.job_slug || activeJob?.job_slug));
        const thumbnail = escapeHtml(api.getThumbnailUrl(clip));
        const download = escapeHtml(api.getDownloadUrl(clip));
        const rangeStr = `${formatStamp(start)} - ${formatStamp(end)}`;

        return `
          <div class="inline-clip-card ${isApproved ? 'is-approved' : ''}" data-clip-uid="${escapeHtml(clip.clip_uid || String(originalIndex))}">
            <!-- 9:16 Video Player Surface -->
            <div class="inline-media-frame">
              ${thumbnail ? `
                <img src="${thumbnail}" alt="${title}" loading="lazy" class="card-thumb-img card-poster-layer">
              ` : ''}
              ${videoSrc ? `
                <video
                  class="inline-card-video"
                  src="${videoSrc}"
                  preload="metadata"
                  playsinline
                  crossorigin="anonymous"
                ></video>
              ` : !thumbnail ? `
                <div class="clip-missing-media">Video ready</div>
              ` : ''}

              <!-- Top Overlay: Badges & Audio Toggle -->
              <div class="inline-top-bar">
                <div class="inline-badges-left">
                  <span class="inline-dur-badge">${duration}</span>
                  <span class="inline-viral-badge">🔥 ${score}</span>
                  ${isApproved ? `<span class="inline-approved-badge">✓ Approved</span>` : ''}
                </div>
                <div class="inline-tools-right">
                  <button type="button" class="inline-tool-btn btn-toggle-sound" title="Mute / Unmute">
                    <svg class="sound-icon-unmuted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Center Play / Pause Floating Trigger -->
              <div class="inline-center-trigger">
                <button type="button" class="inline-center-play-btn" aria-label="Play inline">
                  <svg class="play-svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>

              <!-- Bottom Timeline & Scrubber Bar -->
              <div class="inline-bottom-bar">
                <div class="inline-scrubber-wrap">
                  <input
                    type="range"
                    class="inline-scrubber"
                    min="0"
                    max="100"
                    value="0"
                    step="0.1"
                    aria-label="Seek clip"
                  />
                  <div class="inline-progress-fill" style="width: 0%;"></div>
                </div>
                <div class="inline-time-row">
                  <span class="inline-cur-time">0:00</span>
                  <span class="inline-range-tag">${rangeStr}</span>
                </div>
              </div>
            </div>

            <!-- Card Bottom Actions & Details -->
            <div class="inline-card-body">
              <h4 class="inline-card-title" title="${title}">${title}</h4>
              <div class="inline-card-dock">
                <!-- Tier 1: Primary Action Row -->
                <div class="card-dock-primary-row">
                  <button
                    type="button"
                    class="card-dock-btn dock-btn-approve btn-approve-dock ${isApproved ? 'is-approved approved' : 'action-approve'}"
                    title="${isApproved ? 'Approved for posting (Click to unapprove)' : 'Approve clip & send to publishing calendar'}"
                    data-clip-uid="${escapeHtml(clip.clip_uid || String(originalIndex))}"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>${isApproved ? 'Approved' : 'Approve'}</span>
                  </button>

                  ${download || videoSrc ? `
                    <a
                      href="${download || videoSrc}"
                      ${download ? 'download' : ''}
                      class="card-dock-btn dock-btn-download"
                      title="Download 1080p MP4"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Download</span>
                    </a>
                  ` : ''}
                </div>

                <!-- Tier 2: Secondary Tools & Copy Row -->
                <div class="card-dock-secondary-row">
                  <button
                    type="button"
                    class="card-dock-btn dock-btn-tool btn-edit-cut"
                    title="Open in Video Editor to adjust start and end cut points"
                    data-clip-uid="${escapeHtml(clip.clip_uid || String(originalIndex))}"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="6" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                    </svg>
                    <span>Edit Cut</span>
                  </button>

                  <button
                    type="button"
                    class="card-dock-btn dock-btn-tool btn-open-insights"
                    title="View AI Virality Insights & Edit Copy"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span>Insights</span>
                  </button>

                  <button
                    type="button"
                    class="card-dock-btn dock-btn-icon btn-quick-copy"
                    title="Copy Social Caption"
                    data-caption="${escapeHtml(caption)}"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="source-video-category-block" data-video-id="${escapeHtml(vId)}">
          <!-- Source Video Section Header -->
          <div class="source-video-header">
            <div class="source-video-info">
              <div class="source-icon-badge">🎬</div>
              <div>
                <div class="source-meta-line">
                  <span class="badge-source-tag">Source Video</span>
                  <span class="source-date">${createdDate}</span>
                </div>
                <h3 class="source-video-title">${sourceTitle}</h3>
              </div>
            </div>
            <div class="source-video-actions">
              <span class="source-clip-counter">${videoClips.length} ${videoClips.length === 1 ? 'Clip' : 'Clips'}</span>
            </div>
          </div>

          <!-- Grid of Inline Playable Clip Cards -->
          <div class="inline-clip-grid">
            ${cardsHtml || '<div class="data-empty-card compact"><h3>No clips match filter</h3><p>Switch to All Clips to view all generated clips for this video.</p></div>'}
          </div>
        </div>
      `;
    }).join('');

    const viralTotal = clips.filter((c) => Number(c.virality_score || 0) >= 90).length;
    const shortTotal = clips.filter((c) => (Number(c.end_seconds || 0) - Number(c.start_seconds || 0)) < 30).length;
    const stdTotal = clips.length - shortTotal;

    container.innerHTML = `
      <div class="studio-section">
        <!-- Top Categorization & Filter Navigation Bar -->
        <div class="library-nav-bar">
          <!-- Source Video Category Filter Tabs -->
          <div class="source-category-tabs">
            <button
              type="button"
              class="cat-tab-btn ${activeSourceVideo === 'all' ? 'active' : ''}"
              data-source="all"
            >
              <span>📁 All Videos</span>
              <small>(${clips.length} clips)</small>
            </button>
            ${videoIds.map((vId, idx) => {
              const j = jobMap[vId];
              const count = (clipsByVideo[vId] || []).length;
              const name = j?.source_title || (j?.source_url ? 'Video #' + (idx + 1) : `Video #${idx + 1}`);
              return `
                <button
                  type="button"
                  class="cat-tab-btn ${activeSourceVideo === vId ? 'active' : ''}"
                  data-source="${escapeHtml(vId)}"
                  title="${escapeHtml(name)}"
                >
                  <span>🎬 ${escapeHtml(name)}</span>
                  <small>(${count})</small>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Virality Filter Pills -->
          <div class="gallery-filter-pills" role="tablist">
            <button type="button" class="filter-pill ${activeViralityFilter === 'all' ? 'active' : ''}" data-filter="all">
              All (${clips.length})
            </button>
            <button type="button" class="filter-pill ${activeViralityFilter === 'viral' ? 'active' : ''}" data-filter="viral">
              🔥 S-Tier (${viralTotal})
            </button>
            <button type="button" class="filter-pill ${activeViralityFilter === 'short' ? 'active' : ''}" data-filter="short">
              ⚡ <30s (${shortTotal})
            </button>
            <button type="button" class="filter-pill ${activeViralityFilter === 'standard' ? 'active' : ''}" data-filter="standard">
              ⏱ 30s-60s (${stdTotal})
            </button>
          </div>
        </div>

        <!-- Render All Grouped Video Categories -->
        <div class="source-categories-container">
          ${sectionsHtml}
        </div>
      </div>
    `;

    // Hook Source Video Tabs
    container.querySelectorAll('.cat-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSourceVideo = btn.dataset.source;
        update();
      });
    });

    // Hook Virality Filters
    container.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeViralityFilter = pill.dataset.filter;
        update();
      });
    });

    // Hook Interactive Inline Players on Every Card
    container.querySelectorAll('.inline-clip-card').forEach((card) => {
      const video = card.querySelector('.inline-card-video');
      const trigger = card.querySelector('.inline-center-trigger');
      const playIcon = card.querySelector('.play-svg');
      const scrubber = card.querySelector('.inline-scrubber');
      const progressFill = card.querySelector('.inline-progress-fill');
      const curTime = card.querySelector('.inline-cur-time');
      const soundBtn = card.querySelector('.btn-toggle-sound');
      const insightsBtn = card.querySelector('.btn-open-insights');
      const copyBtn = card.querySelector('.btn-quick-copy');
      const approveBtn = card.querySelector('.btn-approve-dock');

      const uid = card.dataset.clipUid;
      const clip = clips.find((c, i) => String(c.clip_uid || i) === uid) || clips[0];

      // Quick Approve / Unapprove
      approveBtn?.addEventListener('click', async () => {
        const isCurrentlyApproved = String(clip.status || '').toLowerCase() === 'approved';
        if (isCurrentlyApproved) {
          clip.status = 'ready';
          clip.scheduled_at = null;
          state.notify('CLIPS_UPDATED', state.clips);
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'Clip moved back to review queue.' }));
          try {
            if (clip.clip_uid) await api.approveClip(clip.clip_uid, { decision: 'rejected', expected_version: clip.version || 1 });
          } catch (_) {}
        } else {
          state.approveClip(clip.clip_uid || uid);
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '✓ Clip approved and queued for posting!' }));
          try {
            if (clip.clip_uid) await api.approveClip(clip.clip_uid, { decision: 'approved', expected_version: clip.version || 1 });
          } catch (_) {}
        }
        update();
      });

      // Open in Video Editor to adjust start and end cut points
      const editCutBtn = card.querySelector('.btn-edit-cut');
      editCutBtn?.addEventListener('click', () => {
        state.setEditingClip(clip);
        state.setSelectedClip(clip);
        window.dispatchEvent(new CustomEvent('SWITCH_VIEW', { detail: { view: 'editor' } }));
      });

      // Quick Copy Caption
      copyBtn?.addEventListener('click', async () => {
        const text = copyBtn.dataset.caption || clip.caption || '';
        try {
          await navigator.clipboard.writeText(text);
          const orig = copyBtn.innerHTML;
          copyBtn.innerHTML = `✓`;
          setTimeout(() => { copyBtn.innerHTML = orig; }, 1800);
        } catch (e) {}
      });

      // Open AI Insights Drawer / Modal
      insightsBtn?.addEventListener('click', () => {
        openInspectorModal(clip);
      });

      const posterImg = card.querySelector('.card-poster-layer');
      if (video) {
        video.muted = false; // Start unmuted so users hear playback directly

        const setPlaying = (playing) => {
          if (playing) {
            if (posterImg) posterImg.classList.add('hidden');
            trigger.classList.add('playing');
            playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
          } else {
            trigger.classList.remove('playing');
            playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
          }
        };

        const togglePlay = async () => {
          if (video.paused) {
            // Pause all other videos on the page
            document.querySelectorAll('video').forEach((v) => {
              if (v !== video && !v.paused) v.pause();
            });
            try {
              await video.play();
            } catch (err) {}
          } else {
            video.pause();
          }
        };

        trigger?.addEventListener('click', togglePlay);
        video.addEventListener('play', () => setPlaying(true));
        video.addEventListener('pause', () => setPlaying(false));
        video.addEventListener('ended', () => setPlaying(false));

        video.addEventListener('timeupdate', () => {
          if (!isNaN(video.duration) && video.duration > 0) {
            const pct = (video.currentTime / video.duration) * 100;
            if (scrubber) scrubber.value = pct;
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (curTime) curTime.textContent = formatTime(video.currentTime);
          }
        });

        scrubber?.addEventListener('input', (e) => {
          if (Number.isFinite(video.duration) && video.duration > 0) {
            const targetTime = (e.target.value / 100) * video.duration;
            video.currentTime = targetTime;
            if (progressFill) progressFill.style.width = `${e.target.value}%`;
          }
        });

        soundBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          video.muted = !video.muted;
          soundBtn.innerHTML = video.muted
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        });
      }
    });
  }

  state.subscribe((_, action) => {
    if (['CLIPS_UPDATED', 'SELECTED_CLIP_CHANGED', 'JOBS_UPDATED', 'ACTIVE_JOB_CHANGED'].includes(action)) update();
  });
  update();
}
