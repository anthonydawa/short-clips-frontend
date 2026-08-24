/**
 * Short Clips AI — 9:16 Vertical Video Player Component
 */

import { state } from '../state.js';
import { api } from '../api.js';

export function renderVerticalPlayer(container) {
  function formatTime(secs) {
    if (isNaN(secs)) return '0:00';
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

    const videoSrc = api.getVideoStreamUrl(selectedClip, activeJob?.job_slug);
    const subSrc = api.getSubtitleStreamUrl(selectedClip, activeJob?.job_slug);

    container.innerHTML = `
      <div class="glass-panel" style="padding: 20px;">
        <div class="phone-mockup-frame">
          <div class="phone-notch"></div>

          <!-- Video Element -->
          <video id="player-video" class="phone-video" src="${videoSrc}" playsinline preload="auto">
            ${subSrc ? `<track label="Subtitles" kind="subtitles" srclang="en" src="${subSrc}" default>` : ''}
          </video>

          <!-- Custom Player Controls Overlay -->
          <div class="player-controls-overlay">
            <!-- Scrubber & Time -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="player-current-time" style="font-family: var(--font-mono); font-size: 11px; color: #ffffff;">0:00</span>
              <input type="range" id="player-scrubber" class="scrubber-bar" min="0" max="100" value="0" step="0.1">
              <span id="player-duration" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">0:00</span>
            </div>

            <!-- Button Row -->
            <div class="player-btn-row">
              <div style="display: flex; align-items: center; gap: 6px;">
                <button id="btn-play-pause" class="btn btn-primary btn-sm" style="padding: 6px 12px;">
                  <span id="play-icon">▶ Play</span>
                </button>
                <button id="btn-loop" class="btn btn-ghost btn-sm" title="Toggle Loop" style="padding: 6px;">
                  🔁
                </button>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <!-- Direct Download MP4 -->
                <a href="${videoSrc}" download="${selectedClip.generated_title || 'short_clip'}.mp4" class="btn btn-accent btn-sm" target="_blank" style="padding: 6px 10px; font-size: 12px;">
                  ⬇ MP4
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook video controls
    const video = container.querySelector('#player-video');
    const playBtn = container.querySelector('#btn-play-pause');
    const playIcon = container.querySelector('#play-icon');
    const scrubber = container.querySelector('#player-scrubber');
    const curTime = container.querySelector('#player-current-time');
    const durTime = container.querySelector('#player-duration');
    const loopBtn = container.querySelector('#btn-loop');

    if (video) {
      video.addEventListener('loadedmetadata', () => {
        durTime.textContent = formatTime(video.duration);
      });

      video.addEventListener('timeupdate', () => {
        if (!isNaN(video.duration) && video.duration > 0) {
          const pct = (video.currentTime / video.duration) * 100;
          scrubber.value = pct;
          curTime.textContent = formatTime(video.currentTime);
        }
      });

      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playIcon.textContent = '⏸ Pause';
        } else {
          video.pause();
          playIcon.textContent = '▶ Play';
        }
      });

      scrubber.addEventListener('input', (e) => {
        if (!isNaN(video.duration)) {
          video.currentTime = (e.target.value / 100) * video.duration;
        }
      });

      loopBtn.addEventListener('click', () => {
        video.loop = !video.loop;
        loopBtn.style.color = video.loop ? 'var(--accent-cyan)' : 'var(--text-secondary)';
      });

      video.addEventListener('ended', () => {
        if (!video.loop) playIcon.textContent = '▶ Play';
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
