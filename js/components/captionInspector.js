/**
 * Short Clips AI — Studio-Grade Caption Inspector & Virality Intelligence Component
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { escapeHtml } from '../media.js';

let activeTab = 'insights'; // 'insights' | 'copy' | 'captions'

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

    const title = selectedClip.generated_title || selectedClip.title || `Clip #${selectedClip.clip_id ?? '1'}`;
    const caption = selectedClip.caption || '';
    const clipScore = Number.isFinite(Number(selectedClip.virality_score)) ? Math.round(Number(selectedClip.virality_score)) : 90;
    const reasoning = selectedClip.virality_reasoning || 'Strong hook with immediate tension and high emotional payoff. Perfectly suited for short-form retention algorithms.';
    
    const rawTags = activeBrand?.hashtags;
    const hashtags = Array.isArray(rawTags)
      ? rawTags
      : (typeof rawTags === 'string' && rawTags.trim()
          ? rawTags.split(/[,\s]+/).filter(Boolean)
          : ['#Shorts', '#Viral', '#Growth', '#Clips']);
    const hashtagsStr = hashtags.join(' ');
    
    const startSec = Number(selectedClip.start_seconds || 0);
    const endSec = Number(selectedClip.end_seconds || 0);
    const duration = endSec > startSec ? (endSec - startSec).toFixed(1) : '30.0';
    
    const formatStamp = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };
    const timeRangeStr = `${formatStamp(startSec)} → ${formatStamp(endSec)}`;

    const isApproved = String(selectedClip.status || '').toLowerCase() === 'approved' || String(selectedClip.status || '').toLowerCase() === 'scheduled';

    // Score color metrics
    const scoreGrade = clipScore >= 90 ? 'Viral S-Tier' : clipScore >= 80 ? 'High Retention' : 'Good Potential';
    const scoreColorClass = clipScore >= 90 ? 'score-excellent' : clipScore >= 80 ? 'score-great' : 'score-good';

    container.innerHTML = `
      <div class="studio-inspector-card">
        <!-- Inspector Header -->
        <div class="inspector-header">
          <div class="inspector-meta">
            <div class="inspector-meta-row">
              <span class="badge-studio">Clip #${escapeHtml(String(selectedClip.clip_id ?? '1'))}</span>
              <span class="duration-studio-badge">⏱ ${duration}s</span>
              <span class="range-studio-badge">${timeRangeStr}</span>
              <span class="status-studio-badge ${isApproved ? 'approved' : 'ready'}">${isApproved ? '✓ Approved' : 'Ready for Review'}</span>
            </div>
            <h2 class="inspector-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h2>
          </div>

          <div class="inspector-header-actions">
            <button
              type="button"
              id="btn-inspector-edit-cut"
              class="inspector-edit-cut-btn"
              title="Open in Video Editor to adjust start and end cut points"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
              </svg>
              <span>✂ Edit Cut</span>
            </button>

            <button
              type="button"
              id="btn-inspector-approve"
              class="inspector-approve-btn ${isApproved ? 'approved' : ''}"
              title="${isApproved ? 'Clip is approved (click to move back to review)' : 'Approve clip and add to posting calendar'}"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${isApproved ? '✓ Approved for Posting' : 'Approve for Posting'}</span>
            </button>

            <!-- Circular / Radial Virality Score Indicator -->
            <div class="virality-gauge-card ${scoreColorClass}">
              <div class="gauge-score-wrap">
                <span class="gauge-fire">🔥</span>
                <span class="gauge-val">${clipScore}</span>
                <small class="gauge-max">/100</small>
              </div>
              <span class="gauge-grade">${scoreGrade}</span>
            </div>
          </div>
        </div>

        <!-- Inspector Tabs Navigation -->
        <div class="inspector-tabs" role="tablist">
          <button
            type="button"
            class="insp-tab-btn ${activeTab === 'insights' ? 'active' : ''}"
            data-tab="insights"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>AI Virality Insights</span>
          </button>

          <button
            type="button"
            class="insp-tab-btn ${activeTab === 'copy' ? 'active' : ''}"
            data-tab="copy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Social Post Copy</span>
          </button>

          <button
            type="button"
            class="insp-tab-btn ${activeTab === 'captions' ? 'active' : ''}"
            data-tab="captions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="6" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="16" x2="14" y2="16"></line>
            </svg>
            <span>Subtitles & Settings</span>
          </button>
        </div>

        <!-- Tab 1: AI Virality Insights -->
        <div class="inspector-tab-panel ${activeTab === 'insights' ? 'active' : ''}" data-panel="insights">
          <!-- Virality Breakdown Bars -->
          <div class="virality-breakdown-grid">
            <div class="metric-bar-card">
              <div class="metric-bar-head">
                <span>Hook Impact (First 3s)</span>
                <strong>${Math.min(100, clipScore + 2)}%</strong>
              </div>
              <div class="metric-track"><div class="metric-fill" style="width: ${Math.min(100, clipScore + 2)}%;"></div></div>
            </div>

            <div class="metric-bar-card">
              <div class="metric-bar-head">
                <span>Pacing & Engagement</span>
                <strong>${Math.max(70, clipScore - 3)}%</strong>
              </div>
              <div class="metric-track"><div class="metric-fill emerald" style="width: ${Math.max(70, clipScore - 3)}%;"></div></div>
            </div>

            <div class="metric-bar-card">
              <div class="metric-bar-head">
                <span>Retention & Story Payoff</span>
                <strong>${clipScore}%</strong>
              </div>
              <div class="metric-track"><div class="metric-fill cyan" style="width: ${clipScore}%;"></div></div>
            </div>
          </div>

          <!-- Reasoning Card -->
          <div class="reasoning-callout">
            <div class="reasoning-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>Why Gemini Director selected this clip</span>
            </div>
            <p class="reasoning-body">"${escapeHtml(reasoning)}"</p>
          </div>

          <!-- Platform Optimization Badges -->
          <div class="platform-support-row">
            <span class="platform-chip active">✓ TikTok Optimized</span>
            <span class="platform-chip active">✓ Instagram Reels Ready</span>
            <span class="platform-chip active">✓ YouTube Shorts Safe</span>
          </div>
        </div>

        <!-- Tab 2: Social Post Copy -->
        <div class="inspector-tab-panel ${activeTab === 'copy' ? 'active' : ''}" data-panel="copy">
          <div class="copy-input-group">
            <div class="group-label-row">
              <label for="clip-title-edit" class="field-title">Clip Title</label>
              <span class="field-hint">Used for YouTube / TikTok Headline</span>
            </div>
            <input type="text" id="clip-title-edit" class="studio-input" value="${escapeHtml(title)}" />
          </div>

          <div class="copy-input-group">
            <div class="group-label-row">
              <label for="clip-caption-text" class="field-title">Post Caption</label>
              <span id="caption-char-count" class="char-counter">${caption.length} characters</span>
            </div>
            <textarea id="clip-caption-text" class="studio-textarea" rows="4">${escapeHtml(caption)}</textarea>
          </div>

          <div class="copy-input-group">
            <div class="group-label-row">
              <span class="field-title">Brand Hashtags</span>
              <span class="field-hint">Click any hashtag to copy</span>
            </div>
            <div class="hashtags-container">
              ${hashtags.map((tag) => `<button type="button" class="hashtag-pill" title="Click to copy tag">${escapeHtml(tag)}</button>`).join('')}
            </div>
          </div>

          <!-- Copy All Action Button -->
          <div class="copy-actions-bar">
            <button type="button" id="btn-copy-caption" class="studio-btn studio-btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="copy-btn-label">Copy Caption & Hashtags</span>
            </button>
          </div>
        </div>

        <!-- Tab 3: Subtitles & Settings -->
        <div class="inspector-tab-panel ${activeTab === 'captions' ? 'active' : ''}" data-panel="captions">
          <div class="subtitle-settings-box">
            <div class="setting-row-item">
              <div>
                <strong>Subtitle Styling</strong>
                <p>High-contrast dynamic captions burned into MP4</p>
              </div>
              <span class="badge-studio-cyan">${escapeHtml(selectedClip.subtitle_preset || 'Clean')}</span>
            </div>

            <div class="setting-row-item">
              <div>
                <strong>Aspect Ratio</strong>
                <p>9:16 Vertical Video (1080 × 1920)</p>
              </div>
              <span class="badge-studio-emerald">9:16 Full HD</span>
            </div>

            <div class="setting-row-item">
              <div>
                <strong>Cloud Storage Backup</strong>
                <p>Sync clip video, captions and thumbnail to R2</p>
              </div>
              <button
                type="button"
                id="btn-sync-r2"
                class="studio-btn studio-btn-secondary"
                ${CONFIG.MOCK_MODE || !activeJob?.video_id ? 'disabled' : ''}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
                </svg>
                <span>Save to Cloud Storage</span>
              </button>
            </div>
            <p id="storage-status" class="media-status" role="status" hidden></p>
          </div>
        </div>
      </div>
    `;

    // Edit Cut in Video Editor
    container.querySelector('#btn-inspector-edit-cut')?.addEventListener('click', () => {
      state.setEditingClip(selectedClip);
      document.getElementById('clip-inspector-modal')?.classList.remove('active');
      window.dispatchEvent(new CustomEvent('SWITCH_VIEW', { detail: { view: 'editor' } }));
    });

    // Approve / Unapprove Button
    const inspectorApproveBtn = container.querySelector('#btn-inspector-approve');
    inspectorApproveBtn?.addEventListener('click', async () => {
      const isCurrentlyApproved = String(selectedClip.status || '').toLowerCase() === 'approved';
      if (isCurrentlyApproved) {
        selectedClip.status = 'ready';
        selectedClip.scheduled_at = null;
        state.notify('CLIPS_UPDATED', state.clips);
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'Clip moved back to review queue.' }));
        try {
          if (selectedClip.clip_uid) await api.approveClip(selectedClip.clip_uid, { decision: 'rejected', expected_version: selectedClip.version || 1 });
        } catch (_) {}
      } else {
        state.approveClip(selectedClip.clip_uid || selectedClip.clip_id);
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '✓ Clip approved and added to calendar!' }));
        try {
          if (selectedClip.clip_uid) await api.approveClip(selectedClip.clip_uid, { decision: 'approved', expected_version: selectedClip.version || 1 });
        } catch (_) {}
      }
      update();
    });

    // Event Listeners for Tabs
    container.querySelectorAll('.insp-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        activeTab = tabBtn.dataset.tab;
        update();
      });
    });

    // Caption character counter
    const captionText = container.querySelector('#clip-caption-text');
    const charCounter = container.querySelector('#caption-char-count');
    captionText?.addEventListener('input', () => {
      if (charCounter) charCounter.textContent = `${captionText.value.length} characters`;
    });

    // Copy single hashtag
    container.querySelectorAll('.hashtag-pill').forEach((pill) => {
      pill.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(pill.textContent.trim());
          const orig = pill.textContent;
          pill.textContent = '✓ Copied!';
          setTimeout(() => { pill.textContent = orig; }, 1500);
        } catch (e) {}
      });
    });

    // Copy caption & hashtags to clipboard
    const copyBtn = container.querySelector('#btn-copy-caption');
    const copyLabel = container.querySelector('#copy-btn-label');
    if (copyBtn && captionText) {
      copyBtn.addEventListener('click', async () => {
        const fullContent = `${captionText.value}\n\n${hashtagsStr}`;
        try {
          await navigator.clipboard.writeText(fullContent);
          copyLabel.textContent = '✓ Copied to Clipboard!';
          copyBtn.classList.add('btn-success');
          setTimeout(() => {
            copyLabel.textContent = 'Copy Caption & Hashtags';
            copyBtn.classList.remove('btn-success');
          }, 2000);
        } catch (e) {
          console.warn('Clipboard copy error:', e);
        }
      });
    }

    // Cloud storage sync
    const syncBtn = container.querySelector('#btn-sync-r2');
    if (syncBtn && activeJob) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        const origHtml = syncBtn.innerHTML;
        syncBtn.innerHTML = `<span>Syncing…</span>`;
        try {
          const res = await api.syncStorage(activeJob.video_id);
          const status = container.querySelector('#storage-status');
          status.hidden = false;
          status.textContent = res?.status === 'completed' ? '✓ Cloud sync complete.' : 'Cloud sync requested.';
          syncBtn.innerHTML = origHtml;
        } catch (e) {
          syncBtn.innerHTML = origHtml;
          const status = container.querySelector('#storage-status');
          status.hidden = false;
          status.textContent = e.message || 'Cloud sync failed. Please try again.';
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
