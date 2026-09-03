/**
 * Short Clips AI — Video Ingestion Card Component
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { connectJobWebSocket } from '../websocket.js';
import { CONFIG } from '../config.js';
import { escapeHtml } from '../media.js';
import { validateVideoFile, validateYouTubeUrl } from '../uploads.js';

function formatSeconds(sec, isEnd = false) {
  if (isEnd && (sec >= 7200 || sec === null || sec === undefined)) return 'End of video';
  const total = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function parseTimestampToSeconds(str) {
  if (!str) return null;
  const cleaned = String(str).trim();
  if (!cleaned || cleaned.toLowerCase().includes('end')) return null;
  if (!isNaN(cleaned)) return Math.max(0, parseFloat(cleaned));
  const parts = cleaned.split(':');
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

export function renderIngestionCard(container) {
  const MAX_TIMELINE_SEC = 7200; // 2 hours slider scale

  let activeTab = 'youtube'; // 'youtube' | 'upload'
  let selectedFile = null;
  let isSubmitting = false;
  let isAutoCount = true;
  let youtubeUrl = '';
  let clipCount = CONFIG.DEFAULT_CLIP_COUNT;
  let customInstructions = '';
  let startSec = 0;
  let endSec = MAX_TIMELINE_SEC;
  let startInputVal = '00:00:00';
  let endInputVal = '';
  let formError = '';
  let uploadController = null;
  let submittingJob = false;
  let uploadPercent = 0;

  function chooseFile(file) {
    if (isSubmitting) return;
    try {
      validateVideoFile(file);
      selectedFile = file;
      formError = '';
    } catch (error) {
      selectedFile = null;
      formError = error.message;
    }
    render();
  }

  function getSelectionSummary() {
    if (startSec === 0 && endSec >= MAX_TIMELINE_SEC) {
      return 'Full video (00:00 to End)';
    }
    const sStr = formatSeconds(startSec);
    if (endSec >= MAX_TIMELINE_SEC) {
      return `From ${sStr} to End of video`;
    }
    const eStr = formatSeconds(endSec);
    const durSec = Math.max(0, endSec - startSec);
    const durMin = (durSec / 60).toFixed(1).replace('.0', '');
    return `${sStr} → ${eStr} (${durMin} min window)`;
  }

  function render() {
    const activeBrand = state.getActiveBrand();
    const submitLabel = !state.user
      ? 'Sign in to generate clips'
      : !activeBrand
        ? 'Set up brand to continue'
        : 'Generate clips';

    const leftPct = (startSec / MAX_TIMELINE_SEC) * 100;
    const widthPct = Math.max(0, ((endSec - startSec) / MAX_TIMELINE_SEC) * 100);

    container.innerHTML = `
      <div class="glass-panel-glow ingestion-card">
        <!-- Tabs Header -->
        <div class="ingestion-tabs">
          <button class="tab-btn ${activeTab === 'youtube' ? 'active' : ''}" id="tab-youtube" ${isSubmitting ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube link
          </button>
          <button class="tab-btn ${activeTab === 'upload' ? 'active' : ''}" id="tab-upload" ${isSubmitting ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload a video
          </button>
        </div>

        <!-- Form Ingestion -->
        <form id="ingestion-form">
          ${CONFIG.MOCK_MODE ? '<p class="ingestion-notice" role="status">Preview mode: video processing and Cloudflare R2 uploads are not connected yet.</p>' : ''}
          <p class="ingestion-error" role="alert" ${formError ? '' : 'hidden'}>${escapeHtml(formError)}</p>
          ${
            activeTab === 'youtube'
              ? `
            <div class="input-row">
              <div class="url-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <input type="url" id="youtube-url-input" aria-label="YouTube video URL" placeholder="Paste a YouTube video link" value="${escapeHtml(youtubeUrl)}" ${isSubmitting ? 'disabled' : ''} required>
              </div>
              <button type="button" id="btn-paste-url" class="btn btn-secondary" title="Paste from clipboard" ${isSubmitting ? 'disabled' : ''}>
                Paste link
              </button>
            </div>
          `
              : `
            <div class="dropzone" id="file-dropzone" role="button" tabindex="${isSubmitting ? '-1' : '0'}" aria-label="Choose a video file" aria-disabled="${isSubmitting}">
              <div class="dropzone-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; color: #171717;">
                  ${selectedFile ? escapeHtml(selectedFile.name) : 'Drop your long-form video here'}
                </div>
                <div style="font-size: 12px; color: #777;">or click to choose an MP4, MOV, MKV, or AVI file · up to 2 GiB</div>
              </div>
              <input type="file" id="file-input" accept=".mp4,.mov,.mkv,.avi" style="display: none;" ${isSubmitting ? 'disabled' : ''}>
            </div>
          `
          }
          ${isSubmitting && activeTab === 'upload' ? `
            <div class="upload-status" role="status" aria-live="polite">
              <label for="upload-progress" id="upload-progress-label">${submittingJob ? 'Upload complete. Starting processing…' : `Uploading to cloud storage: ${uploadPercent}%`}</label>
              <progress id="upload-progress" max="100" value="${uploadPercent}"></progress>
              <button type="button" id="cancel-upload" class="btn btn-secondary btn-sm" ${submittingJob ? 'disabled' : ''}>Cancel upload</button>
            </div>` : ''}

          <!-- TIME RANGE SEGMENT PICKER (VISIBLE DIRECTLY ON CARD) -->
          <div class="segment-picker-box">
            <div class="segment-picker-header">
              <h4>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Video Segment Range
              </h4>
              <span class="segment-badge" id="segment-summary-badge">${escapeHtml(getSelectionSummary())}</span>
            </div>

            <!-- Dual Range Slider Track -->
            <div class="dual-range-container">
              <div class="dual-range-track"></div>
              <div class="dual-range-highlight" id="dual-range-highlight" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
              <input type="range" class="dual-range-input" id="range-slider-start" min="0" max="${MAX_TIMELINE_SEC}" step="15" value="${startSec}" ${isSubmitting ? 'disabled' : ''}>
              <input type="range" class="dual-range-input" id="range-slider-end" min="0" max="${MAX_TIMELINE_SEC}" step="15" value="${endSec}" ${isSubmitting ? 'disabled' : ''}>
            </div>

            <!-- Start / End Manual Time Inputs -->
            <div class="segment-inputs-grid">
              <div class="segment-input-item">
                <label for="cfg-start-time">Start Time (Left Handle)</label>
                <input type="text" id="cfg-start-time" placeholder="00:00:00" value="${escapeHtml(startInputVal)}" ${isSubmitting ? 'disabled' : ''}>
              </div>
              <div class="segment-input-item">
                <label for="cfg-end-time">End Time (Right Handle)</label>
                <input type="text" id="cfg-end-time" placeholder="End of video (Full)" value="${escapeHtml(endInputVal)}" ${isSubmitting ? 'disabled' : ''}>
              </div>
            </div>

            <!-- Quick Preset Chips -->
            <div class="segment-presets-row">
              <button type="button" class="preset-chip ${startSec === 0 && endSec >= MAX_TIMELINE_SEC ? 'active' : ''}" data-preset="full">Full Video</button>
              <button type="button" class="preset-chip ${startSec === 0 && endSec === 900 ? 'active' : ''}" data-preset="15m">First 15 min</button>
              <button type="button" class="preset-chip ${startSec === 0 && endSec === 1800 ? 'active' : ''}" data-preset="30m">First 30 min</button>
              <button type="button" class="preset-chip ${startSec === 1800 && endSec === 2700 ? 'active' : ''}" data-preset="30_45m">30m to 45m (15m sample)</button>
              <button type="button" class="preset-chip ${startSec === 0 && endSec === 3600 ? 'active' : ''}" data-preset="60m">First 1 Hour</button>
            </div>
          </div>

          <!-- Target Clips and Special Instructions Row -->
          <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 16px; margin-top: 18px;">
            <div class="setting-item setting-item-count" style="padding: 16px; background: #fbfaf8; border: 1px solid #e7e4df; border-radius: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label class="setting-label" for="cfg-clip-count" style="font-weight: 700; color: #171717; font-size: 13px; margin: 0;">
                  Target Clips
                </label>
                <div class="clip-count-pill-toggle">
                  <button type="button" class="btn-count-mode ${isAutoCount ? 'active' : ''}" id="btn-mode-auto" title="Extract all high-impact viral moments detected">⚡ Auto (Max)</button>
                  <button type="button" class="btn-count-mode ${!isAutoCount ? 'active' : ''}" id="btn-mode-custom" title="Choose an exact number of clips">Fixed (${clipCount})</button>
                </div>
              </div>

              ${isAutoCount ? `
                <div class="auto-count-box">
                  <div class="auto-count-badge">
                    <span>⚡ Auto-Detect Mode</span>
                  </div>
                  <p class="setting-help" style="font-size: 11px; color: #57534e; margin: 6px 0 0 0; line-height: 1.4;">
                    AI will scan the entire video and extract <strong>all usable high-retention clips</strong> without a rigid fixed limit.
                  </p>
                </div>
              ` : `
                <div class="custom-count-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; color: #78716c;">Exact count:</span>
                    <strong id="val-clip-count" style="color: #ff2d2d; font-size: 14px; font-weight: 800;">${clipCount} clips</strong>
                  </div>
                  <input type="range" id="cfg-clip-count" min="1" max="15" value="${clipCount}" ${isSubmitting ? 'disabled' : ''} style="width: 100%; accent-color: #ff2d2d;">
                  <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #a8a29e; margin-top: 2px;">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                    <span>15</span>
                  </div>
                </div>
              `}
            </div>

            <div class="setting-item setting-item-direction" style="padding: 16px; background: #fbfaf8; border: 1px solid #e7e4df; border-radius: 12px;">
              <label class="setting-label" for="cfg-custom-instructions" style="font-weight: 700; color: #171717; font-size: 13px; display: block; margin-bottom: 4px;">
                Direction / Focus <span style="color: #999; font-weight: normal; font-size: 11px;">(Optional)</span>
              </label>
              <textarea id="cfg-custom-instructions" rows="2" placeholder="Example: Focus on key revelations, practical advice, and viral hooks." ${isSubmitting ? 'disabled' : ''} style="width: 100%; color: #171717; background: #ffffff; border: 1px solid #dcd8d3; border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 12px; resize: vertical;">${escapeHtml(customInstructions)}</textarea>
            </div>
          </div>

          <!-- Submit Button Row -->
          <div style="margin-top: 22px; display: flex; justify-content: flex-end;">
            <button type="submit" id="btn-submit-job" class="btn btn-primary btn-lg" style="min-width: 220px; font-weight: 800; font-size: 14px;" ${isSubmitting || (activeTab === 'upload' && !selectedFile) ? 'disabled' : ''}>
              ${isSubmitting ? '<span class="anim-spin"></span> Processing…' : `${submitLabel} <span aria-hidden="true">→</span>`}
            </button>
          </div>
        </form>
      </div>
    `;

    // Tab buttons
    container.querySelector('#tab-youtube').addEventListener('click', () => {
      if (isSubmitting) return;
      activeTab = 'youtube';
      render();
    });
    container.querySelector('#tab-upload').addEventListener('click', () => {
      if (isSubmitting) return;
      activeTab = 'upload';
      render();
    });

    // Slider range elements
    const sliderStart = container.querySelector('#range-slider-start');
    const sliderEnd = container.querySelector('#range-slider-end');
    const highlight = container.querySelector('#dual-range-highlight');
    const summaryBadge = container.querySelector('#segment-summary-badge');
    const inputStart = container.querySelector('#cfg-start-time');
    const inputEnd = container.querySelector('#cfg-end-time');

    function updateSliderVisuals() {
      const l = (startSec / MAX_TIMELINE_SEC) * 100;
      const w = Math.max(0, ((endSec - startSec) / MAX_TIMELINE_SEC) * 100);
      if (highlight) {
        highlight.style.left = `${l}%`;
        highlight.style.width = `${w}%`;
      }
      if (summaryBadge) {
        summaryBadge.textContent = getSelectionSummary();
      }
    }

    if (sliderStart && sliderEnd) {
      sliderStart.addEventListener('input', (e) => {
        let val = Number(e.target.value);
        if (val >= endSec - 30) {
          val = Math.max(0, endSec - 30);
          sliderStart.value = val;
        }
        startSec = val;
        startInputVal = formatSeconds(startSec);
        if (inputStart) inputStart.value = startInputVal;
        updateSliderVisuals();
      });

      sliderEnd.addEventListener('input', (e) => {
        let val = Number(e.target.value);
        if (val <= startSec + 30) {
          val = Math.min(MAX_TIMELINE_SEC, startSec + 30);
          sliderEnd.value = val;
        }
        endSec = val;
        endInputVal = endSec >= MAX_TIMELINE_SEC ? '' : formatSeconds(endSec);
        if (inputEnd) inputEnd.value = endInputVal;
        updateSliderVisuals();
      });
    }

    // Manual input typing handlers
    inputStart?.addEventListener('input', (e) => {
      startInputVal = e.target.value;
      const parsed = parseTimestampToSeconds(startInputVal);
      if (parsed !== null && parsed < endSec) {
        startSec = Math.max(0, parsed);
        if (sliderStart) sliderStart.value = startSec;
        updateSliderVisuals();
      }
    });

    inputEnd?.addEventListener('input', (e) => {
      endInputVal = e.target.value;
      const parsed = parseTimestampToSeconds(endInputVal);
      if (parsed !== null && parsed > startSec) {
        endSec = Math.min(MAX_TIMELINE_SEC, parsed);
        if (sliderEnd) sliderEnd.value = endSec;
      } else if (!endInputVal.trim() || endInputVal.toLowerCase().includes('end')) {
        endSec = MAX_TIMELINE_SEC;
        if (sliderEnd) sliderEnd.value = MAX_TIMELINE_SEC;
      }
      updateSliderVisuals();
    });

    // Preset buttons
    container.querySelectorAll('.preset-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'full') {
          startSec = 0;
          endSec = MAX_TIMELINE_SEC;
          startInputVal = '00:00:00';
          endInputVal = '';
        } else if (preset === '15m') {
          startSec = 0;
          endSec = 900;
          startInputVal = '00:00:00';
          endInputVal = '15:00';
        } else if (preset === '30m') {
          startSec = 0;
          endSec = 1800;
          startInputVal = '00:00:00';
          endInputVal = '30:00';
        } else if (preset === '30_45m') {
          startSec = 1800;
          endSec = 2700;
          startInputVal = '30:00';
          endInputVal = '45:00';
        } else if (preset === '60m') {
          startSec = 0;
          endSec = 3600;
          startInputVal = '00:00:00';
          endInputVal = '01:00:00';
        }
        render();
      });
    });

    // Paste button
    const pasteBtn = container.querySelector('#btn-paste-url');
    container.querySelector('#youtube-url-input')?.addEventListener('input', (event) => { youtubeUrl = event.target.value; });
    container.querySelector('#cfg-custom-instructions')?.addEventListener('input', (event) => { customInstructions = event.target.value; });
    container.querySelector('#cancel-upload')?.addEventListener('click', () => uploadController?.abort());
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && !isSubmitting) {
            youtubeUrl = text.trim();
            const input = container.querySelector('#youtube-url-input');
            if (input) input.value = youtubeUrl;
          }
        } catch (e) {
          console.warn('Clipboard read failed');
        }
      });
    }

    // Dropzone handlers
    const dropzone = container.querySelector('#file-dropzone');
    const fileInput = container.querySelector('#file-input');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => { if (!isSubmitting) fileInput.click(); });
      dropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!isSubmitting) fileInput.click(); }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          chooseFile(e.target.files[0]);
        }
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
          chooseFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Auto / Custom clip count mode toggle
    container.querySelector('#btn-mode-auto')?.addEventListener('click', () => {
      if (isSubmitting) return;
      isAutoCount = true;
      render();
    });
    container.querySelector('#btn-mode-custom')?.addEventListener('click', () => {
      if (isSubmitting) return;
      isAutoCount = false;
      render();
    });

    // Slider clip count
    const slider = container.querySelector('#cfg-clip-count');
    const sliderVal = container.querySelector('#val-clip-count');
    slider?.addEventListener('input', (e) => {
      clipCount = Number(e.target.value);
      if (sliderVal) sliderVal.textContent = `${e.target.value} clips`;
    });

    // Form Submission
    container.querySelector('#ingestion-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!state.user) {
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
        return;
      }
      if (!state.getActiveBrand()) {
        state.updateProgress('FAILED', 0, 'Your workspace brand is loading. Please refresh and try again.', true);
        return;
      }
      const brandId = state.activeBrandId || undefined;
      if (!isAutoCount) {
        const countInput = container.querySelector('#cfg-clip-count');
        if (countInput) clipCount = parseInt(countInput.value, 10);
      }
      const targetClipCount = isAutoCount ? 0 : clipCount;
      const subtitlePreset = 'clean';
      customInstructions = container.querySelector('#cfg-custom-instructions')?.value || '';

      // Capture/validate the source before rendering replaces the form.
      let url;
      try {
        if (activeTab === 'youtube') url = validateYouTubeUrl(container.querySelector('#youtube-url-input').value.trim());
        else validateVideoFile(selectedFile);
      } catch (error) {
        formError = error.message;
        render();
        return;
      }
      formError = '';
      uploadPercent = 0;
      submittingJob = activeTab === 'youtube';
      uploadController = activeTab === 'upload' ? new AbortController() : null;

      const finalStartTime = startSec > 0 ? formatSeconds(startSec) : undefined;
      const finalEndTime = endSec < MAX_TIMELINE_SEC ? formatSeconds(endSec) : undefined;
      const finalStartSec = startSec > 0 ? startSec : undefined;
      const finalEndSec = endSec < MAX_TIMELINE_SEC ? endSec : undefined;

      const payload = {
        brand_id: brandId,
        target_clip_count: targetClipCount,
        subtitle_preset: subtitlePreset,
        custom_instructions: customInstructions,
        start_time: finalStartTime,
        end_time: finalEndTime,
        start_seconds: finalStartSec,
        end_seconds: finalEndSec,
      };

      // Capture settings before the loading render replaces the form controls.
      isSubmitting = true;
      render();

      try {
        state.resetProgress();
        if (activeTab === 'youtube') state.updateProgress('INGESTION', 0, 'Submitting source video…', true);

        let result;
        if (activeTab === 'youtube') {
          result = await api.submitJob({ ...payload, url });
        } else {
          result = await api.uploadVideo(selectedFile, payload, {
            signal: uploadController.signal,
            onProgress: ({ loaded, total }) => {
              uploadPercent = Math.floor(loaded / total * 100);
              const progress = container.querySelector('#upload-progress');
              const label = container.querySelector('#upload-progress-label');
              if (progress) progress.value = uploadPercent;
              if (label) label.textContent = `Uploading to cloud storage: ${uploadPercent}%`;
            },
            onUploaded: () => { submittingJob = true; render(); },
          });
        }

        if (!result?.video_id) throw new Error('The server did not return a processing job.');
        console.log('🚀 Job submitted successfully:', result);
        state.setActiveJob(result);
        state.setJobs([result, ...state.jobs.filter((job) => job.video_id !== result.video_id)]);
        state.setClips([]);
        state.updateProgress('INGESTION', 0, 'Source received. Processing is queued.', true);

        // Connect WebSocket for real-time progress
        const videoId = result.video_id;
        connectJobWebSocket(videoId);

        // Scroll to progress card
        document.getElementById('progress-section')?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        formError = err.name === 'AbortError' ? 'Upload cancelled. No processing job was started.' : err.message;
        if (err.name === 'AbortError') state.resetProgress();
        else state.updateProgress('FAILED', 0, formError, true);
      } finally {
        isSubmitting = false;
        uploadController = null;
        render();
      }
    });
  }

  state.subscribe((_, action) => {
    if (['ACTIVE_BRAND_CHANGED', 'BRANDS_UPDATED', 'USER_CHANGED', 'USER_ACCESS_CHANGED'].includes(action)) {
      render();
    }
  });

  render();
}
