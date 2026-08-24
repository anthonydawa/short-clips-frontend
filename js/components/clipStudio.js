import { state } from '../state.js';
import { api } from '../api.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

export function renderClipStudio(container) {
  function update() {
    const clips = state.clips;
    const selectedClip = state.selectedClip;
    const activeJob = state.activeJob;

    if (!clips?.length) {
      container.innerHTML = `
        <div class="studio-section">
          <div class="data-empty-card library-empty">
            <span>▦</span>
            <h2>Your clip library is empty</h2>
            <p>When the processing server returns completed clips for your account, they will appear here automatically.</p>
            <button data-switch="create">Add a long-form video</button>
          </div>
        </div>`;
      return;
    }

    const cards = clips.map((clip, index) => {
      const selected = selectedClip?.clip_uid === clip.clip_uid;
      const start = Number(clip.start_seconds || 0);
      const end = Number(clip.end_seconds || 0);
      const duration = end > start ? `${(end - start).toFixed(1)}s` : 'Clip';
      const score = Number(clip.virality_score);
      const title = escapeHtml(clip.generated_title || clip.title || `Clip ${index + 1}`);
      const videoSrc = escapeHtml(api.getVideoStreamUrl(clip, activeJob?.job_slug));
      return `
        <button class="clip-card ${selected ? 'selected' : ''}" data-uid="${escapeHtml(clip.clip_uid || String(index))}" type="button">
          <div class="clip-card-media">
            ${videoSrc ? `<video src="${videoSrc}" preload="metadata" muted playsinline></video>` : '<div class="clip-missing-media">Video unavailable</div>'}
            <div class="clip-card-overlay">
              <div class="card-top-badges"><div class="badge badge-purple">${duration}</div>${Number.isFinite(score) ? `<div class="virality-pill">${score}/100</div>` : ''}</div>
              <div class="card-bottom-info"><div class="clip-card-title">${title}</div><div class="clip-card-meta"><span>${escapeHtml(clip.status || 'Ready')}</span><span>Inspect clip</span></div></div>
            </div>
          </div>
        </button>`;
    }).join('');

    container.innerHTML = `<div class="studio-section"><div class="section-header"><div><div class="badge badge-cyan">Clip library</div><h2>${clips.length} generated ${clips.length === 1 ? 'clip' : 'clips'}</h2></div></div><div class="clip-grid">${cards}</div></div>`;

    container.querySelectorAll('.clip-card').forEach((card, index) => {
      card.addEventListener('click', () => state.setSelectedClip(clips[index]));
      const video = card.querySelector('video');
      card.addEventListener('mouseenter', () => video?.play().catch(() => {}));
      card.addEventListener('mouseleave', () => video?.pause());
    });
  }

  state.subscribe((_, action) => {
    if (['CLIPS_UPDATED', 'SELECTED_CLIP_CHANGED'].includes(action)) update();
  });
  update();
}
