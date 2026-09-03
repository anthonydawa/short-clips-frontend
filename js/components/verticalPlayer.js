/**
 * Short Clips AI — Studio-Grade 9:16 Vertical Video Player Component
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, getClipMediaIssue } from '../media.js';

let isSafeZonesActive = false;
let currentPlaybackRate = 1.0;

export function renderVerticalPlayer(container) {
  function formatTime(secs) {
    if (isNaN(secs) || !Number.isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function update() {
    const selectedClip = state.selectedClip;
    const activeJob = state.activeJob;

    if (!selectedClip) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;

    const videoSrc = escapeHtml(api.getVideoStreamUrl(selectedClip, activeJob?.job_slug));
    const subSrc = escapeHtml(api.getSubtitleStreamUrl(selectedClip, activeJob?.job_slug));
    const thumbnail = escapeHtml(api.getThumbnailUrl(selectedClip));
    const download = escapeHtml(api.getDownloadUrl(selectedClip));
    const clipNum = selectedClip.clip_id ?? '1';
    const score = Number.isFinite(Number(selectedClip.virality_score)) ? Math.round(Number(selectedClip.virality_score)) : 90;

    container.innerHTML = `
      <div class="studio-player-card">
        <!-- Main 9:16 Video Player Container -->
        <div class="studio-player-wrap">
          <!-- Ambient Backlight Glow -->
          <div class="player-ambient-glow"></div>

          <!-- Video Surface -->
          <div class="player-screen">
            <video
              id="player-video"
              class="studio-video"
              ${videoSrc ? `src="${videoSrc}"` : ''}
              ${thumbnail ? `poster="${thumbnail}"` : ''}
              playsinline
              preload="metadata"
            >
              ${subSrc ? `<track label="Subtitles" kind="subtitles" srclang="en" src="${subSrc}">` : ''}
            </video>

            <!-- Social Platform Safe Zones Overlay -->
            <div id="safe-zones-overlay" class="safe-zones-layer ${isSafeZonesActive ? 'active' : ''}">
              <div class="safe-zone-top"><span class="safe-zone-tag">Top Header Safe Area</span></div>
              <div class="safe-zone-right">
                <div class="safe-icon-mock">♥</div>
                <div class="safe-icon-mock">💬</div>
                <div class="safe-icon-mock">↗</div>
                <div class="safe-icon-mock">🎵</div>
              </div>
              <div class="safe-zone-bottom">
                <span class="safe-zone-tag">Captions & Audio Bar Area</span>
              </div>
            </div>

            <!-- Top Header Overlay -->
            <div class="player-top-overlay">
              <div class="player-clip-tag">
                <span class="clip-badge-dot"></span>
                <span>Clip #${escapeHtml(String(clipNum))}</span>
                <span class="score-mini-pill">🔥 ${score}</span>
              </div>
              <div class="player-top-actions">
                <button
                  type="button"
                  id="btn-toggle-safezones"
                  class="player-pill-btn ${isSafeZonesActive ? 'active' : ''}"
                  title="Toggle TikTok / Reels / Shorts Safe Zone Guides"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span>Safe zones</span>
                </button>
                <span class="player-quality-badge">1080p</span>
              </div>
            </div>

            <!-- Center Big Play/Pause Floating Button -->
            <div id="center-play-overlay" class="center-play-trigger">
              <button type="button" class="center-play-btn" aria-label="Play or Pause">
                <svg id="center-play-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            </div>

            <!-- Bottom Floating Glass Controls -->
            <div class="player-bottom-overlay">
              <!-- Scrubber Bar -->
              <div class="player-timeline">
                <div class="timeline-bar-wrap">
                  <input
                    type="range"
                    id="player-scrubber"
                    class="studio-scrubber"
                    min="0"
                    max="100"
                    value="0"
                    step="0.1"
                    aria-label="Video scrubber"
                  />
                  <div id="timeline-progress-fill" class="timeline-fill" style="width: 0%;"></div>
                </div>
              </div>

              <!-- Controls Row -->
              <div class="player-controls-bar">
                <div class="controls-left">
                  <button type="button" id="btn-play-pause" class="ctrl-btn main-play-btn" title="Play / Pause">
                    <svg id="ctrl-play-svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </button>

                  <button type="button" id="btn-volume" class="ctrl-btn" title="Mute / Unmute">
                    <svg id="vol-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  </button>

                  <div class="time-readout">
                    <span id="player-current-time">0:00</span>
                    <span class="time-divider">/</span>
                    <span id="player-duration">0:00</span>
                  </div>
                </div>

                <div class="controls-right">
                  <!-- Speed Selector -->
                  <button type="button" id="btn-speed" class="ctrl-btn speed-btn" title="Playback Speed">
                    <span id="speed-label">${currentPlaybackRate}x</span>
                  </button>

                  <!-- Loop Toggle -->
                  <button type="button" id="btn-loop" class="ctrl-btn" title="Toggle Loop">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="17 1 21 5 17 9"></polyline>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                      <polyline points="7 23 3 19 7 15"></polyline>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                    </svg>
                  </button>

                  <!-- Fullscreen -->
                  <button type="button" id="btn-fullscreen" class="ctrl-btn" title="Fullscreen">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Dock Below Player -->
        <div class="player-action-dock">
          ${download || videoSrc ? `
            <a
              href="${download || videoSrc}"
              ${download ? 'download' : ''}
              class="dock-btn dock-btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download 1080p MP4</span>
            </a>
          ` : ''}

          <button type="button" id="btn-copy-link" class="dock-btn dock-btn-secondary" title="Copy direct video URL">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span id="copy-link-text">Copy link</span>
          </button>

          <button type="button" id="refresh-media" class="dock-btn dock-btn-ghost" title="Refresh download link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>

        <p id="player-media-status" class="media-status" role="status" ${videoSrc ? 'hidden' : ''}>
          ${escapeHtml(getClipMediaIssue(selectedClip, activeJob?.job_slug))}
        </p>
      </div>
    `;

    // Hook Video Elements & Events
    const video = container.querySelector('#player-video');
    const centerTrigger = container.querySelector('#center-play-overlay');
    const playBtn = container.querySelector('#btn-play-pause');
    const centerIcon = container.querySelector('#center-play-icon');
    const ctrlPlaySvg = container.querySelector('#ctrl-play-svg');
    const scrubber = container.querySelector('#player-scrubber');
    const progressFill = container.querySelector('#timeline-progress-fill');
    const curTime = container.querySelector('#player-current-time');
    const durTime = container.querySelector('#player-duration');
    const volBtn = container.querySelector('#btn-volume');
    const speedBtn = container.querySelector('#btn-speed');
    const speedLabel = container.querySelector('#speed-label');
    const loopBtn = container.querySelector('#btn-loop');
    const fsBtn = container.querySelector('#btn-fullscreen');
    const safeZonesBtn = container.querySelector('#btn-toggle-safezones');
    const safeZonesLayer = container.querySelector('#safe-zones-overlay');
    const copyLinkBtn = container.querySelector('#btn-copy-link');
    const copyLinkText = container.querySelector('#copy-link-text');
    const refreshBtn = container.querySelector('#refresh-media');
    const mediaStatus = container.querySelector('#player-media-status');

    const showError = (message) => {
      mediaStatus.hidden = false;
      mediaStatus.textContent = message;
    };

    // Safe zones toggle
    safeZonesBtn?.addEventListener('click', () => {
      isSafeZonesActive = !isSafeZonesActive;
      safeZonesBtn.classList.toggle('active', isSafeZonesActive);
      safeZonesLayer.classList.toggle('active', isSafeZonesActive);
    });

    // Copy direct link
    copyLinkBtn?.addEventListener('click', async () => {
      if (!videoSrc) return;
      try {
        await navigator.clipboard.writeText(videoSrc);
        copyLinkText.textContent = 'Copied!';
        setTimeout(() => { copyLinkText.textContent = 'Copy link'; }, 2000);
      } catch (err) {
        console.warn('Clipboard copy error:', err);
      }
    });

    // Refresh media links
    refreshBtn?.addEventListener('click', async () => {
      const videoId = selectedClip.video_id || activeJob?.video_id;
      if (!videoId) return showError('This clip is missing its processing job reference.');
      refreshBtn.disabled = true;
      try {
        const detail = await api.getJobDetail(videoId);
        if (!Array.isArray(detail?.clips)) throw new Error('Media links could not be refreshed.');
        if (state.selectedClip !== selectedClip) return;
        state.setActiveJob(detail.job || activeJob);
        state.setClips(detail.clips);
      } catch (error) {
        showError(error.message);
      } finally {
        refreshBtn.disabled = false;
      }
    });

    if (video) {
      video.playbackRate = currentPlaybackRate;

      const setPlayingUI = (playing) => {
        if (playing) {
          centerTrigger.classList.add('playing');
          ctrlPlaySvg.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
          centerIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
        } else {
          centerTrigger.classList.remove('playing');
          ctrlPlaySvg.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
          centerIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
        }
      };

      const togglePlay = async () => {
        if (video.paused) {
          try {
            await video.play();
          } catch (err) {
            if (err.name !== 'AbortError') showError('Playback was prevented by your browser.');
          }
        } else {
          video.pause();
        }
      };

      centerTrigger?.addEventListener('click', togglePlay);
      playBtn?.addEventListener('click', togglePlay);

      video.addEventListener('play', () => setPlayingUI(true));
      video.addEventListener('pause', () => setPlayingUI(false));
      video.addEventListener('ended', () => {
        if (!video.loop) setPlayingUI(false);
      });

      video.addEventListener('loadedmetadata', () => {
        durTime.textContent = formatTime(video.duration);
      });

      video.addEventListener('timeupdate', () => {
        if (!isNaN(video.duration) && video.duration > 0) {
          const pct = (video.currentTime / video.duration) * 100;
          scrubber.value = pct;
          progressFill.style.width = `${pct}%`;
          curTime.textContent = formatTime(video.currentTime);
        }
      });

      scrubber?.addEventListener('input', (e) => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const targetTime = (e.target.value / 100) * video.duration;
          video.currentTime = targetTime;
          progressFill.style.width = `${e.target.value}%`;
        }
      });

      // Volume / Mute
      volBtn?.addEventListener('click', () => {
        video.muted = !video.muted;
        const icon = container.querySelector('#vol-icon');
        if (video.muted) {
          icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
          volBtn.style.color = '#ef4444';
        } else {
          icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
          volBtn.style.color = '';
        }
      });

      // Speed cycle: 1x -> 1.25x -> 1.5x -> 2x -> 1x
      const speeds = [1.0, 1.25, 1.5, 2.0];
      speedBtn?.addEventListener('click', () => {
        const nextIdx = (speeds.indexOf(currentPlaybackRate) + 1) % speeds.length;
        currentPlaybackRate = speeds[nextIdx];
        video.playbackRate = currentPlaybackRate;
        speedLabel.textContent = `${currentPlaybackRate}x`;
      });

      // Loop
      loopBtn?.addEventListener('click', () => {
        video.loop = !video.loop;
        loopBtn.classList.toggle('active', video.loop);
      });

      // Fullscreen
      fsBtn?.addEventListener('click', () => {
        const screen = container.querySelector('.player-screen');
        if (!document.fullscreenElement) {
          screen?.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      });
    }
  }

  state.subscribe((_, action) => {
    if (action === 'SELECTED_CLIP_CHANGED') {
      update();
    }
  });

  update();
}
