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
      container.innerHTML = `
        <div class="glass-panel" style="padding: 32px 24px; text-align: center; color: var(--text-muted);">
          Select a clip from the studio gallery to inspect its virality score, AI reasoning, and social media captions.
        </div>
      `;
      return;
    }

    const title = selectedClip.generated_title || selectedClip.title || `Clip #${selectedClip.clip_id}`;
    const caption = selectedClip.caption || '';
    const virality = selectedClip.virality_score || 85;
    const reasoning = selectedClip.virality_reasoning || 'Identified high-retention standalone epiphany with strong opening hook and emotional peak.';
    const rawTags = activeBrand?.hashtags;
    const hashtags = Array.isArray(rawTags)
      ? rawTags
      : (typeof rawTags === 'string' && rawTags.trim()
          ? rawTags.split(/[,\s]+/).filter(Boolean)
          : ['#Shorts', '#Viral', '#Mindset', '#Growth', '#Motivation']);
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
          <div class="virality-pill" style="font-size: 14px; padding: 6px 14px;">
            🔥 ${virality}/100 Virality
          </div>
        </div>

        <!-- AI Virality Reasoning Card -->
        <div style="background: rgba(11, 17, 33, 0.7); border: 1px solid rgba(250, 204, 21, 0.25); border-radius: var(--radius-md); padding: 14px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--accent-yellow); margin-bottom: 6px;">
            <span>🧠 AI Content Breakdown & Rationale</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ${reasoning}
          </p>
        </div>

        <!-- Caption Box -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="setting-label" style="font-size: 12px;">Optimized Social Media Caption</label>
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
            ${hashtags.map((tag) => `<span class="badge badge-cyan" style="font-size: 11px; text-transform: none;">${tag}</span>`).join('')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <button id="btn-copy-caption" class="btn btn-primary" style="flex: 1;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Caption & Tags
          </button>
          <button id="btn-sync-r2" class="btn btn-secondary" title="Sync to Cloudflare R2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
            Sync R2
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
          copyBtn.innerHTML = '✅ Copied to Clipboard!';
          setTimeout(() => {
            copyBtn.innerHTML = orig;
          }, 2000);
        } catch (e) {
          alert('Copied: ' + fullContent);
        }
      });
    }

    // Sync to R2
    const syncBtn = container.querySelector('#btn-sync-r2');
    if (syncBtn && activeJob) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '⏳ Syncing...';
        try {
          const res = await api.syncStorage(activeJob.video_id);
          alert('Cloudflare R2 Sync Complete! ' + (res.message || ''));
        } catch (e) {
          alert('R2 Sync Error: ' + e.message);
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = 'Sync R2';
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
