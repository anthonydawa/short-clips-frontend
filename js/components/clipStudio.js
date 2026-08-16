/**
 * Short Clips AI — Clip Studio Gallery (9:16 Cards Grid)
 */

import { state } from '../state.js';
import { api } from '../api.js';

export function renderClipStudio(container) {
  function update() {
    const clips = state.clips;
    const selectedClip = state.selectedClip;
    const activeJob = state.activeJob;

    if (!clips || clips.length === 0) {
      container.innerHTML = `
        <div class="studio-section" id="studio-section">
          <div class="glass-panel" style="padding: 48px 24px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 12px;">🎬</div>
            <h3 style="font-size: 20px; margin-bottom: 8px;">No Short Clips Generated Yet</h3>
            <p style="color: var(--text-muted); font-size: 14px; max-width: 460px; margin: 0 auto 20px;">
              Enter a YouTube link or upload a horizontal video above to let the Two-Agent AI director craft viral 9:16 shorts.
            </p>
          </div>
        </div>
      `;
      return;
    }

    const cardsHtml = clips.map((clip, index) => {
      const isSelected = selectedClip?.clip_uid === clip.clip_uid;
      const duration = (clip.end_seconds - clip.start_seconds).toFixed(1);
      const virality = clip.virality_score || 85;
      const title = clip.generated_title || clip.title || `Clip #${clip.clip_id}`;
      const videoSrc = api.getVideoStreamUrl(clip, activeJob?.job_slug);

      return `
        <div class="clip-card ${isSelected ? 'selected' : ''}" data-uid="${clip.clip_uid}">
          <div class="clip-card-media">
            <video src="${videoSrc}" preload="metadata" muted playsinline></video>
            <div class="clip-card-overlay">
              <div class="card-top-badges">
                <div class="virality-pill">🔥 ${virality}/100</div>
                <div class="badge badge-purple">${duration}s</div>
              </div>
              <div class="card-bottom-info">
                <div class="clip-card-title">${title}</div>
                <div class="clip-card-meta">
                  <span>#${clip.clip_id}</span>
                  <span style="color: var(--accent-cyan);">Click to Inspect 📱</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="studio-section" id="studio-section">
        <div class="section-header">
          <div>
            <div class="badge badge-cyan" style="margin-bottom: 6px;">Studio Gallery</div>
            <h2 style="font-size: 28px;">Curated Viral Shorts (${clips.length})</h2>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="btn-refresh-clips" class="btn btn-secondary btn-sm" title="Refresh Clips">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="clip-grid">
          ${cardsHtml}
        </div>
      </div>
    `;

    // Click handler on clip cards
    container.querySelectorAll('.clip-card').forEach((card) => {
      card.addEventListener('click', () => {
        const uid = card.getAttribute('data-uid');
        const target = clips.find((c) => c.clip_uid === uid);
        if (target) {
          state.setSelectedClip(target);
        }
      });

      // Quick video preview on hover
      const videoEl = card.querySelector('video');
      card.addEventListener('mouseenter', () => {
        if (videoEl && videoEl.paused) videoEl.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        if (videoEl && !videoEl.paused) videoEl.pause();
      });
    });

    const refreshBtn = container.querySelector('#btn-refresh-clips');
    if (refreshBtn && activeJob) {
      refreshBtn.addEventListener('click', async () => {
        try {
          const detail = await api.getJobDetail(activeJob.video_id);
          state.setClips(detail.clips || []);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  state.subscribe((_, action) => {
    if (['CLIPS_UPDATED', 'SELECTED_CLIP_CHANGED'].includes(action)) {
      update();
    }
  });

  update();
}
