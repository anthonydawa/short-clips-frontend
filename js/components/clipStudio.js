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
          <div class="section-header" style="margin-bottom: 20px;">
            <div>
              <div class="badge badge-purple" style="margin-bottom: 6px;">✨ Creative Inspiration</div>
              <h2 style="font-size: 26px;">Viral 9:16 Short Formats</h2>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 28px;">
            <!-- Format 1 -->
            <div class="glass-panel" style="padding: 20px; border-left: 3px solid #eab308; background: rgba(15, 23, 42, 0.6);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px;">🔥</span>
                <span class="badge badge-yellow">Hormozi Kinetic</span>
              </div>
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Bold Contrast & High Energy</div>
              <div style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                High-impact yellow & green word-by-word highlights, rapid micro-zooms, and sub-0.2s pause cuts.
              </div>
            </div>

            <!-- Format 2 -->
            <div class="glass-panel" style="padding: 20px; border-left: 3px solid #06b6d4; background: rgba(15, 23, 42, 0.6);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px;">⚡</span>
                <span class="badge badge-cyan">Clean Neon</span>
              </div>
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Minimal & Sleek Tech</div>
              <div style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                Clean sans-serif fonts, cyan accents, subtle smooth zooms, and aesthetic dark padding.
              </div>
            </div>

            <!-- Format 3 -->
            <div class="glass-panel" style="padding: 20px; border-left: 3px solid #a855f7; background: rgba(15, 23, 42, 0.6);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px;">🧠</span>
                <span class="badge badge-purple">Contrarian Hook</span>
              </div>
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Epiphany & Storytelling</div>
              <div style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                Hooks viewers in the first 2 seconds with an unexpected realization or counter-intuitive principle.
              </div>
            </div>

            <!-- Format 4 -->
            <div class="glass-panel" style="padding: 20px; border-left: 3px solid #10b981; background: rgba(15, 23, 42, 0.6);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px;">🏆</span>
                <span class="badge badge-emerald">Beast Impact</span>
              </div>
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Maximum Hook & Pacing</div>
              <div style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                Ultra-fast pacing, dynamic emojis, sound-effect markers, and high-retention 30-second arcs.
              </div>
            </div>
          </div>

          <div class="glass-panel" style="padding: 32px 20px; text-align: center; border: 1px dashed var(--border-glass-glow);">
            <div style="font-size: 36px; margin-bottom: 8px;">🎬</div>
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">Ready to generate your own shorts?</div>
            <div style="color: var(--text-muted); font-size: 13px; max-width: 480px; margin: 0 auto;">
              Paste a YouTube video link or upload a video file above. Your custom-directed 9:16 clips will appear here automatically.
            </div>
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
