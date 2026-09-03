/**
 * Short Clips AI — Interactive Video Editor Component
 * Allows creators to fine-tune start and end cut points, preview looped ranges,
 * and re-render the finalized 9:16 vertical clip.
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, getMediaUrl } from '../media.js';

function formatTimestamp(sec) {
  if (sec == null || isNaN(sec)) return '00:00:00.000';
  const total = Math.max(0, Number(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total % 1) * 1000);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const mss = String(ms).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mss}`;
}

function parseTimestamp(str) {
  if (!str) return null;
  const clean = String(str).trim();
  if (!isNaN(clean)) return Math.max(0, parseFloat(clean));
  const parts = clean.split(':');
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  } else if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function renderVideoEditor(container) {
  let activeClipUid = null;
  let startSec = 0;
  let endSec = 30;
  let originalStart = 0;
  let originalEnd = 30;
  let generatedTitle = '';
  let caption = '';
  let subtitlePreset = 'clean';
  let isRendering = false;
  let renderError = '';
  let renderSuccess = '';

  function syncFromClip(clip) {
    if (!clip) return;
    activeClipUid = String(clip.clip_uid || clip.clip_id);
    startSec = Number(clip.start_seconds != null ? clip.start_seconds : 0);
    endSec = Number(clip.end_seconds != null ? clip.end_seconds : (startSec + (clip.duration_seconds || 30)));
    originalStart = startSec;
    originalEnd = endSec;
    generatedTitle = clip.generated_title || clip.title || 'Viral Short Clip';
    caption = clip.caption || '';
    subtitlePreset = clip.subtitle_preset || 'clean';
    renderError = '';
    renderSuccess = '';
  }

  function getActiveClip() {
    return state.editingClip || state.selectedClip || state.clips[0] || null;
  }

  function render() {
    const clip = getActiveClip();
    if (!clip) {
      container.innerHTML = `
        <div class="editor-empty-state">
          <div class="empty-icon-circle">✂</div>
          <h3>No Clip Selected for Editing</h3>
          <p>Select any clip from your Clip Library and click <strong>"Edit Cut"</strong> to adjust its start and ending moments.</p>
          <button type="button" class="btn btn-primary" data-switch="library">Go to Clip Library</button>
        </div>
      `;
      container.querySelector('[data-switch="library"]')?.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('SWITCH_VIEW', { detail: { view: 'library' } }));
      });
      return;
    }

    // Sync if switching to a new clip
    const currentUid = String(clip.clip_uid || clip.clip_id);
    if (currentUid !== activeClipUid) {
      syncFromClip(clip);
    }

    const videoUrl = api.getVideoStreamUrl(clip, clip.job_slug);
    const duration = Math.max(0, endSec - startSec);
    const isDurationValid = duration >= 3.0 && duration <= 65.0;
    const isOverShortsLimit = duration > 60.0;
    const hasChanges = Math.abs(startSec - originalStart) > 0.05 || Math.abs(endSec - originalEnd) > 0.05;

    // Surrounding context window for scrubber (at least 60s context before and after)
    const contextMin = Math.max(0, Math.floor(Math.min(startSec, originalStart) - 30));
    const contextMax = Math.ceil(Math.max(endSec, originalEnd) + 45);

    container.innerHTML = `
      <div class="editor-workspace">
        <!-- Editor Header -->
        <div class="editor-header-bar">
          <div class="editor-title-wrap">
            <button type="button" class="btn-back-library" data-switch="library" title="Return to Clip Library">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to Library</span>
            </button>
            <div class="editor-clip-meta">
              <span class="editor-badge">EDITING CLIP #${escapeHtml(String(clip.clip_id || '01'))}</span>
              <h2 class="editor-heading">${escapeHtml(generatedTitle)}</h2>
            </div>
          </div>

          <div class="editor-top-actions">
            <div class="duration-pill ${isOverShortsLimit ? 'warning' : 'good'}">
              <span class="duration-label">Cut Length:</span>
              <strong id="editor-duration-display">${duration.toFixed(1)}s</strong>
              <span class="duration-tag">${isOverShortsLimit ? '⚠️ Exceeds 60s' : '✓ Shorts Ready'}</span>
            </div>
            <button type="button" class="btn btn-primary btn-finalize-cut" id="btn-finalize-cut" ${isRendering || !isDurationValid ? 'disabled' : ''}>
              ${isRendering ? '<span class="anim-spin"></span> Re-rendering Cut…' : '⚡ Re-render & Finalize Clip'}
            </button>
          </div>
        </div>

        ${renderError ? `<div class="editor-alert error">${escapeHtml(renderError)}</div>` : ''}
        ${renderSuccess ? `<div class="editor-alert success">${escapeHtml(renderSuccess)}</div>` : ''}

        <!-- Two Column Editor Grid -->
        <div class="editor-main-grid">
          <!-- Left Column: Video Preview & Playback Transport -->
          <div class="editor-preview-column">
            <div class="editor-player-card">
              <div class="editor-video-wrapper">
                <video 
                  id="editor-video-preview" 
                  src="${videoUrl}" 
                  playsinline 
                  controls 
                  preload="auto"
                  poster="${getMediaUrl(clip, 'thumbnail')}"
                  style="width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 12px;"
                ></video>
                <div class="editor-player-overlay-tag">
                  <span>9:16 Vertical Preview</span>
                </div>
              </div>

              <!-- Transport Bar -->
              <div class="editor-transport-bar">
                <button type="button" class="transport-btn" id="btn-seek-start" title="Seek to Start Cut (${formatTimestamp(startSec)})">
                  ⏮ Seek Start
                </button>
                <button type="button" class="transport-btn primary" id="btn-play-range" title="Play Range Loop">
                  ▶ Play Range Loop
                </button>
                <button type="button" class="transport-btn" id="btn-seek-end" title="Seek to End Cut (${formatTimestamp(endSec)})">
                  ⏭ Seek End
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Timeline Scrubber, Cut Steppers, & Metadata -->
          <div class="editor-controls-column">
            <!-- Timeline Trim Controls Card -->
            <div class="editor-card trim-card">
              <div class="editor-card-header">
                <div class="card-icon-title">
                  <span class="icon-bubble">✂</span>
                  <h3>Cut Boundary Adjustments</h3>
                </div>
                <button type="button" class="btn-reset-cut" id="btn-reset-cut" title="Reset to original AI cut" ${!hasChanges ? 'disabled' : ''}>
                  ↺ Reset Cut
                </button>
              </div>

              <!-- Start Cut Stepper Row -->
              <div class="cut-stepper-block">
                <div class="stepper-header">
                  <label class="stepper-label" for="inp-start-timestamp">
                    <span class="stepper-marker start">●</span>
                    <strong>Start Cut (In-Point)</strong>
                  </label>
                  <input type="text" id="inp-start-timestamp" class="timestamp-input" value="${formatTimestamp(startSec)}" placeholder="00:00:00.000">
                </div>
                <div class="stepper-btn-row">
                  <button type="button" class="step-btn" data-target="start" data-delta="-1.0">-1.0s</button>
                  <button type="button" class="step-btn" data-target="start" data-delta="-0.2">-0.2s</button>
                  <button type="button" class="step-btn" data-target="start" data-delta="+0.2">+0.2s</button>
                  <button type="button" class="step-btn" data-target="start" data-delta="+1.0">+1.0s</button>
                </div>
                <input type="range" id="slider-start" class="range-slider" min="${contextMin}" max="${contextMax}" step="0.1" value="${startSec}">
              </div>

              <!-- End Cut Stepper Row -->
              <div class="cut-stepper-block" style="margin-top: 18px;">
                <div class="stepper-header">
                  <label class="stepper-label" for="inp-end-timestamp">
                    <span class="stepper-marker end">●</span>
                    <strong>End Cut (Out-Point / Payoff)</strong>
                  </label>
                  <input type="text" id="inp-end-timestamp" class="timestamp-input" value="${formatTimestamp(endSec)}" placeholder="00:00:00.000">
                </div>
                <div class="stepper-btn-row">
                  <button type="button" class="step-btn" data-target="end" data-delta="-1.0">-1.0s</button>
                  <button type="button" class="step-btn" data-target="end" data-delta="-0.2">-0.2s</button>
                  <button type="button" class="step-btn" data-target="end" data-delta="+0.2">+0.2s</button>
                  <button type="button" class="step-btn" data-target="end" data-delta="+1.0">+1.0s</button>
                </div>
                <input type="range" id="slider-end" class="range-slider" min="${contextMin}" max="${contextMax}" step="0.1" value="${endSec}">
              </div>

              <div class="cut-summary-tip">
                <span class="tip-icon">💡</span>
                <p>Fine-tune in <strong>0.2s</strong> increments to ensure the clip starts crisply on the first spoken syllable and cuts immediately after the punchline.</p>
              </div>
            </div>

            <!-- Clip Metadata & Captions Card -->
            <div class="editor-card meta-card" style="margin-top: 16px;">
              <div class="editor-card-header">
                <div class="card-icon-title">
                  <span class="icon-bubble">📝</span>
                  <h3>Clip Title & Captions</h3>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 12px;">
                <label class="setting-label" for="editor-clip-title-input">Generated Viral Hook Title</label>
                <input type="text" id="editor-clip-title-input" class="editor-text-input" value="${escapeHtml(generatedTitle)}" placeholder="Enter viral hook title…">
              </div>

              <div class="form-group">
                <label class="setting-label" for="editor-clip-caption-input">Social Post Caption & Hashtags</label>
                <textarea id="editor-clip-caption-input" class="editor-textarea-input" rows="3" placeholder="Add Instagram/YouTube description and hashtags…">${escapeHtml(caption)}</textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook up Video Preview Looper
    const video = container.querySelector('#editor-video-preview');
    if (video) {
      video.addEventListener('timeupdate', () => {
        if (!video.paused && video.currentTime >= endSec) {
          video.currentTime = startSec;
        }
      });
    }

    // Transport buttons
    container.querySelector('#btn-seek-start')?.addEventListener('click', () => {
      if (!video) return;
      video.currentTime = startSec;
      video.play().catch(() => {});
    });

    container.querySelector('#btn-seek-end')?.addEventListener('click', () => {
      if (!video) return;
      video.currentTime = Math.max(startSec, endSec - 1.5);
      video.play().catch(() => {});
    });

    container.querySelector('#btn-play-range')?.addEventListener('click', () => {
      if (!video) return;
      video.currentTime = startSec;
      video.play().catch(() => {});
    });

    // Back to library button
    container.querySelectorAll('[data-switch="library"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('SWITCH_VIEW', { detail: { view: 'library' } }));
      });
    });

    // Reset button
    container.querySelector('#btn-reset-cut')?.addEventListener('click', () => {
      startSec = originalStart;
      endSec = originalEnd;
      render();
    });

    // Stepper buttons
    container.querySelectorAll('.step-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        const delta = parseFloat(e.currentTarget.dataset.delta) || 0;
        if (target === 'start') {
          startSec = Math.max(0, Math.min(endSec - 1.0, +(startSec + delta).toFixed(2)));
        } else if (target === 'end') {
          endSec = Math.max(startSec + 1.0, +(endSec + delta).toFixed(2));
        }
        updateDisplayAndVideo();
      });
    });

    // Range Sliders
    const startSlider = container.querySelector('#slider-start');
    const endSlider = container.querySelector('#slider-end');
    startSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      startSec = Math.min(endSec - 1.0, val);
      updateDisplayAndVideo();
    });
    endSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      endSec = Math.max(startSec + 1.0, val);
      updateDisplayAndVideo();
    });

    // Direct Timestamp Inputs
    const startInput = container.querySelector('#inp-start-timestamp');
    const endInput = container.querySelector('#inp-end-timestamp');
    startInput?.addEventListener('change', (e) => {
      const parsed = parseTimestamp(e.target.value);
      if (parsed != null && parsed < endSec) {
        startSec = parsed;
        updateDisplayAndVideo();
      } else {
        e.target.value = formatTimestamp(startSec);
      }
    });
    endInput?.addEventListener('change', (e) => {
      const parsed = parseTimestamp(e.target.value);
      if (parsed != null && parsed > startSec) {
        endSec = parsed;
        updateDisplayAndVideo();
      } else {
        e.target.value = formatTimestamp(endSec);
      }
    });

    // Finalize Re-render Button
    container.querySelector('#btn-finalize-cut')?.addEventListener('click', async () => {
      if (isRendering) return;
      const titleInput = container.querySelector('#editor-clip-title-input');
      const captionInput = container.querySelector('#editor-clip-caption-input');
      if (titleInput) generatedTitle = titleInput.value.trim();
      if (captionInput) caption = captionInput.value.trim();

      isRendering = true;
      renderError = '';
      renderSuccess = '';
      render();

      try {
        const payload = {
          expected_version: clip.version || 1,
          start_seconds: startSec,
          end_seconds: endSec,
          generated_title: generatedTitle,
          caption: caption,
          subtitle_preset: subtitlePreset,
        };

        const res = await api.renderClip(currentUid, payload);
        const updated = res.result || {
          ...clip,
          start_seconds: startSec,
          end_seconds: endSec,
          duration_seconds: +(endSec - startSec).toFixed(2),
          version: (clip.version || 1) + 1,
          title: generatedTitle,
          caption: caption,
        };

        state.updateClip(updated);
        state.setSelectedClip(updated);
        state.setEditingClip(updated);

        renderSuccess = `✓ Clip #${clip.clip_id || '01'} successfully re-rendered and updated in library!`;
        isRendering = false;
        originalStart = startSec;
        originalEnd = endSec;
        render();

        // After a brief delay, return to the library to show the updated clip
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('SWITCH_VIEW', { detail: { view: 'library' } }));
        }, 1200);
      } catch (err) {
        renderError = err.message || 'Failed to re-render clip cut. Please try again.';
        isRendering = false;
        render();
      }
    });

    function updateDisplayAndVideo() {
      const dur = Math.max(0, endSec - startSec);
      const durDisp = container.querySelector('#editor-duration-display');
      if (durDisp) durDisp.textContent = `${dur.toFixed(1)}s`;

      if (startInput) startInput.value = formatTimestamp(startSec);
      if (endInput) endInput.value = formatTimestamp(endSec);
      if (startSlider) startSlider.value = startSec;
      if (endSlider) endSlider.value = endSec;

      if (video) {
        video.currentTime = startSec;
      }
    }
  }

  // Subscribe to state changes (when user clicks "Edit Cut" from library)
  state.subscribe((appState, action, payload) => {
    if (action === 'EDITING_CLIP_CHANGED' || action === 'SELECTED_CLIP_CHANGED' || action === 'CLIPS_UPDATED') {
      if (payload && (action === 'EDITING_CLIP_CHANGED' || !activeClipUid)) {
        syncFromClip(payload);
      }
      render();
    }
  });

  // Initial render
  syncFromClip(getActiveClip());
  render();
}
