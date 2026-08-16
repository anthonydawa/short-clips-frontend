/**
 * Short Clips AI — Progress Tracker & Real-Time Log Visualizer
 */

import { state } from '../state.js';

const STAGES = [
  { id: 'INGESTION', label: '1. Ingestion', icon: '📥' },
  { id: 'EXTRACTING_AUDIO', label: '2. Audio Prep', icon: '🎵' },
  { id: 'TRANSCRIBING', label: '3. Whisper AI', icon: '🎙️' },
  { id: 'DIRECTING_CLIPS', label: '4. Scene Director', icon: '🧠' },
  { id: 'RENDERING_CLIPS', label: '5. Impact Editor', icon: '🎬' },
  { id: 'COMPLETED', label: '6. Ready', icon: '✨' },
];

export function renderProgressTracker(container) {
  function getStageIndex(currentStage) {
    const idx = STAGES.findIndex((s) => s.id === currentStage);
    return idx === -1 ? 0 : idx;
  }

  function update() {
    const progress = state.progress;
    const isVisible = state.isProcessing || progress.stage === 'COMPLETED' || progress.stage === 'FAILED';

    if (!isVisible) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const currentIdx = getStageIndex(progress.stage);

    const stepsHtml = STAGES.map((s, idx) => {
      let statusClass = '';
      if (progress.stage === 'COMPLETED' || idx < currentIdx) {
        statusClass = 'completed';
      } else if (idx === currentIdx) {
        statusClass = 'active';
      }

      return `
        <div class="timeline-step ${statusClass}">
          <div class="step-icon">${s.icon}</div>
          <div class="step-label">${s.label}</div>
        </div>
      `;
    }).join('');

    const logEntries = progress.logs.length > 0
      ? progress.logs.map((l) => `<div class="log-entry"><span style="color: var(--text-muted);">[${l.time}]</span> <span class="stage">[${l.stage}]</span> ${l.message}</div>`).join('')
      : '<div class="log-entry" style="color: var(--text-muted);">Waiting for pipeline events...</div>';

    container.innerHTML = `
      <div class="glass-panel progress-card" id="progress-section">
        <div class="progress-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="badge ${progress.stage === 'COMPLETED' ? 'badge-emerald' : progress.stage === 'FAILED' ? 'badge-rose' : 'badge-purple anim-pulse'}">
              ${progress.stage || 'PROCESSING'}
            </div>
            <div style="font-weight: 700; font-size: 16px;">
              ${progress.message || 'Processing Video Pipeline...'}
            </div>
          </div>
          <div style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--accent-cyan);">
            ${Math.round(progress.percent)}%
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress.percent}%;"></div>
        </div>

        <!-- Timeline Steps -->
        <div class="timeline-steps">
          ${stepsHtml}
        </div>

        <!-- Terminal Logs -->
        <div style="margin-top: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              Live Pipeline Execution Logs
            </span>
          </div>
          <div class="terminal-box" id="terminal-logs-scroll">
            ${logEntries}
          </div>
        </div>
      </div>
    `;

    // Auto-scroll logs to bottom
    const logBox = container.querySelector('#terminal-logs-scroll');
    if (logBox) {
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  state.subscribe((_, action) => {
    if (action === 'PROGRESS_UPDATED' || action === 'PROGRESS_RESET') {
      update();
    }
  });

  update();
}
