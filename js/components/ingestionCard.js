/**
 * Short Clips AI — Video Ingestion Card Component
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { connectJobWebSocket } from '../websocket.js';

export function renderIngestionCard(container) {
  let activeTab = 'youtube'; // 'youtube' | 'upload'
  let selectedFile = null;
  let isSubmitting = false;

  function render() {
    const activeBrand = state.getActiveBrand();
    const defaultPreset = 'clean';
    const defaultPacing = activeBrand?.pacing_mode || 'snappy';
    const submitLabel = !state.user
      ? 'Sign in to generate clips'
      : !activeBrand
        ? 'Set up brand to continue'
        : 'Generate clips';

    container.innerHTML = `
      <div class="glass-panel-glow ingestion-card">
        <!-- Tabs Header -->
        <div class="ingestion-tabs">
          <button class="tab-btn ${activeTab === 'youtube' ? 'active' : ''}" id="tab-youtube">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube link
          </button>
          <button class="tab-btn ${activeTab === 'upload' ? 'active' : ''}" id="tab-upload">
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
          ${
            activeTab === 'youtube'
              ? `
            <div class="input-row">
              <div class="url-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <input type="url" id="youtube-url-input" aria-label="YouTube video URL" placeholder="Paste a YouTube video link" required>
              </div>
              <button type="button" id="btn-paste-url" class="btn btn-secondary" title="Paste from clipboard">
                Paste link
              </button>
              <button type="submit" id="btn-submit-job" class="btn btn-primary btn-lg" ${isSubmitting ? 'disabled' : ''}>
                ${isSubmitting ? '<span class="anim-spin"></span> Starting…' : `${submitLabel} <span aria-hidden="true">→</span>`}
              </button>
            </div>
          `
              : `
            <div class="dropzone" id="file-dropzone">
              <div class="dropzone-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">
                  ${selectedFile ? selectedFile.name : 'Drop your long-form video here'}
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">or click to choose an MP4, MOV, MKV, or AVI file · up to 2GB</div>
              </div>
              <input type="file" id="file-input" accept="video/mp4,video/quicktime,video/x-matroska,video/avi" style="display: none;">
            </div>
            <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
              <button type="submit" class="btn btn-primary btn-lg" ${!selectedFile || isSubmitting ? 'disabled' : ''}>
                ${isSubmitting ? '<span class="anim-spin"></span> Uploading…' : `${submitLabel} <span aria-hidden="true">→</span>`}
              </button>
            </div>
          `
          }

          <!-- Advanced Settings Drawer -->
          <div class="settings-drawer">
            <div class="drawer-header" id="toggle-drawer">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: var(--text-secondary);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Clip settings <span class="drawer-optional">Optional</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="drawer-arrow">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>

            <div class="drawer-content" id="drawer-content" style="display: none;">
              <!-- Target Clip Count -->
              <div class="setting-item">
                <label class="setting-label">Target Clips: <span id="val-clip-count" style="color: var(--primary); font-weight: 800;">5</span></label>
                <input type="range" id="cfg-clip-count" min="1" max="15" value="5" style="accent-color: var(--primary);">
              </div>

              <!-- Pacing Mode -->
              <div class="setting-item">
                <label class="setting-label">Editing pace</label>
                <select id="cfg-pacing-mode">
                  <option value="snappy" ${defaultPacing === 'snappy' ? 'selected' : ''}>Quick and engaging</option>
                  <option value="hyper">Fast cuts</option>
                  <option value="natural">Natural conversation</option>
                  <option value="cinematic">Story-led</option>
                </select>
              </div>

              <!-- Toggles -->
              <div class="setting-item" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                <div class="toggle-item">
                  <label for="cfg-dead-space" style="font-size: 13px; font-weight: 600; cursor: pointer;">Remove long pauses</label>
                  <input type="checkbox" id="cfg-dead-space" checked style="width: auto; accent-color: var(--primary);">
                </div>
                <div class="toggle-item">
                  <label for="cfg-sfx" style="font-size: 13px; font-weight: 600; cursor: pointer;">Add subtle sound effects</label>
                  <input type="checkbox" id="cfg-sfx" style="width: auto; accent-color: var(--primary);">
                </div>
                <div class="toggle-item">
                  <label for="cfg-top-banner" style="font-size: 13px; font-weight: 600; cursor: pointer;">Add an opening headline</label>
                  <input type="checkbox" id="cfg-top-banner" style="width: auto; accent-color: var(--primary);">
                </div>
              </div>

              <!-- Custom Directing Instructions -->
              <div class="setting-item" style="grid-column: 1 / -1;">
                <label class="setting-label">Direction for this video <span>(optional)</span></label>
                <textarea id="cfg-custom-instructions" rows="2" placeholder="Example: Prioritize practical lessons and customer stories. Avoid inside jokes."></textarea>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    // Tab buttons
    container.querySelector('#tab-youtube').addEventListener('click', () => {
      activeTab = 'youtube';
      render();
    });
    container.querySelector('#tab-upload').addEventListener('click', () => {
      activeTab = 'upload';
      render();
    });

    // Paste button
    const pasteBtn = container.querySelector('#btn-paste-url');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) container.querySelector('#youtube-url-input').value = text;
        } catch (e) {
          console.warn('Clipboard read failed');
        }
      });
    }

    // Dropzone handlers
    const dropzone = container.querySelector('#file-dropzone');
    const fileInput = container.querySelector('#file-input');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          selectedFile = e.target.files[0];
          render();
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
          selectedFile = e.dataTransfer.files[0];
          render();
        }
      });
    }

    // Drawer toggle
    const toggleDrawer = container.querySelector('#toggle-drawer');
    const drawerContent = container.querySelector('#drawer-content');
    const drawerArrow = container.querySelector('#drawer-arrow');
    toggleDrawer.addEventListener('click', () => {
      const isHidden = drawerContent.style.display === 'none';
      drawerContent.style.display = isHidden ? 'grid' : 'none';
      drawerArrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    // Slider label update
    const slider = container.querySelector('#cfg-clip-count');
    const sliderVal = container.querySelector('#val-clip-count');
    slider.addEventListener('input', (e) => {
      sliderVal.textContent = e.target.value;
    });

    // Form Submission
    container.querySelector('#ingestion-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.user) {
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
        return;
      }
      if (state.userAccess?.is_active === false) {
        state.updateProgress('FAILED', 0, 'This account does not currently have app access.', true);
        return;
      }
      if (!state.getActiveBrand()) {
        window.dispatchEvent(new CustomEvent('OPEN_BRAND_MANAGER'));
        return;
      }
      isSubmitting = true;
      render();

      const brandId = state.activeBrandId || undefined;
      const clipCount = parseInt(container.querySelector('#cfg-clip-count').value, 10);
      const subtitlePreset = 'clean';
      const pacingMode = container.querySelector('#cfg-pacing-mode').value;
      const removeDeadSpace = container.querySelector('#cfg-dead-space').checked;
      const enableSfx = container.querySelector('#cfg-sfx').checked;
      const enableTopBanner = container.querySelector('#cfg-top-banner').checked;
      const customInstructions = container.querySelector('#cfg-custom-instructions').value;

      try {
        state.resetProgress();
        state.updateProgress('INGESTION', 5, 'Initializing autonomous video pipeline...', true);

        let result;
        if (activeTab === 'youtube') {
          const url = container.querySelector('#youtube-url-input').value;
          result = await api.submitJob({
            url,
            brand_id: brandId,
            target_clip_count: clipCount,
            subtitle_preset: subtitlePreset,
            pacing_mode: pacingMode,
            remove_dead_space: removeDeadSpace,
            enable_sfx: enableSfx,
            enable_top_banner: enableTopBanner,
            custom_instructions: customInstructions,
          });
        } else {
          const formData = new FormData();
          formData.append('file', selectedFile);
          if (brandId) formData.append('brand_id', brandId);
          formData.append('target_clip_count', clipCount);
          if (customInstructions) formData.append('custom_instructions', customInstructions);
          result = await api.uploadVideo(formData);
        }

        console.log('🚀 Job submitted successfully:', result);
        state.setActiveJob(result);

        // Connect WebSocket for real-time progress
        const videoId = result.video_id;
        connectJobWebSocket(videoId);

        // Scroll to progress card
        document.getElementById('progress-section')?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.warn('Job submission notice:', err.message);
        state.updateProgress('FAILED', 0, 'Error: ' + err.message, true);
      } finally {
        isSubmitting = false;
        render();
      }
    });
  }

  state.subscribe((_, action) => {
    if (action === 'ACTIVE_BRAND_CHANGED') {
      render();
    }
  });

  render();
}
