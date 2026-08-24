/**
 * Short Clips AI — Caption Inspector & Virality Breakdown Component
 */

import { state } from '../state.js';
import { api } from '../api.js';

export function renderCaptionInspector(container) {
  function update() {
    const selectedClip = state.selectedClip;
    const activeJob = state.activeJob;
    const activeBrand = state.getActiveBrand();

    if (!selectedClip) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;

    const title = selectedClip.generated_title || selectedClip.title || `Clip #${selectedClip.clip_id}`;
    const caption = selectedClip.caption || '';
    const clipScore = Number.isFinite(Number(selectedClip.virality_score)) ? Math.round(Number(selectedClip.virality_score)) : null;
    const reasoning = selectedClip.virality_reasoning || 'No selection explanation is available for this clip yet.';
    const rawTags = activeBrand?.hashtags;
    const hashtags = Array.isArray(rawTags)
      ? rawTags
      : (typeof rawTags === 'string' && rawTags.trim()
          ? rawTags.split(/[,\s]+/).filter(Boolean)
          : []);
    const hashtagsStr = hashtags.join(' ');
    const duration = (selectedClip.end_seconds - selectedClip.start_seconds).toFixed(1);

    container.innerHTML = `
      <div class="glass-panel" style="padding: 24px;">
        <!-- Header & Virality Score -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px;">
          <div>
            <div class="badge badge-purple" style="margin-bottom: 6px;">Clip #${selectedClip.clip_id} • ${duration}s</div>
            <h3 style="font-size: 20px; line-height: 1.3;">${title}</h3>
          </div>
          ${clipScore !== null ? `<div class="virality-pill" style="font-size: 14px; padding: 6px 14px;">Clip score ${clipScore}/100</div>` : ''}
        </div>

        <!-- AI Virality Reasoning Card -->
        <div class="clip-reasoning" style="border-radius: var(--radius-md); padding: 14px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 6px;">
            <span>Why this clip was selected</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ${reasoning}
          </p>
        </div>

        <!-- Caption Box -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="setting-label" style="font-size: 12px;">Post caption</label>
            <span id="caption-char-count" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
              ${caption.length} characters
            </span>
          </div>
          <textarea id="clip-caption-text" rows="4" style="line-height: 1.5; font-size: 13px;">${caption}</textarea>
        </div>

        <!-- Hashtags Chips -->
        <div style="margin-bottom: 24px;">
          <label class="setting-label" style="font-size: 12px; margin-bottom: 8px; display: block;">Hashtags</label>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${hashtags.length ? hashtags.map((tag) => `<span class="badge badge-cyan" style="font-size: 11px; text-transform: none;">${tag}</span>`).join('') : '<span class="empty-inline-note">No brand hashtags saved.</span>'}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <button id="btn-copy-caption" class="btn btn-primary" style="flex: 1;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy caption and hashtags
          </button>
          <button id="btn-sync-r2" class="btn btn-secondary" title="Save clip assets to connected cloud storage">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
            Save to cloud
          </button>
        </div>
      </div>
    `;

    // Copy caption & hashtags to clipboard
    const copyBtn = container.querySelector('#btn-copy-caption');
    const captionText = container.querySelector('#clip-caption-text');
    if (copyBtn && captionText) {
      copyBtn.addEventListener('click', async () => {
        const fullContent = `${captionText.value}\n\n${hashtagsStr}`;
        try {
          await navigator.clipboard.writeText(fullContent);
          const orig = copyBtn.innerHTML;
          copyBtn.textContent = 'Copied';
          setTimeout(() => {
            copyBtn.innerHTML = orig;
          }, 2000);
        } catch (e) {
          console.warn('Clipboard copy notice:', e);
        }
      });
    }

    // Sync to R2
    const syncBtn = container.querySelector('#btn-sync-r2');
    if (syncBtn && activeJob) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Saving…';
        try {
          const res = await api.syncStorage(activeJob.video_id);
          syncBtn.textContent = 'Saved';
          setTimeout(() => {
            syncBtn.textContent = 'Save to cloud';
          }, 2000);
        } catch (e) {
          console.warn('R2 Sync notice:', e.message);
          syncBtn.textContent = 'Save to cloud';
        } finally {
          syncBtn.disabled = false;
        }
      });
    }
  }

  state.subscribe((_, action) => {
    if (['SELECTED_CLIP_CHANGED', 'ACTIVE_BRAND_CHANGED'].includes(action)) {
      update();
    }
  });

  update();
}
