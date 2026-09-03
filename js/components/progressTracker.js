/**
 * Short Clips AI — Progress Tracker & Real-Time Log Visualizer
 */

import { state } from '../state.js';
import { escapeHtml } from '../media.js';

const STAGES = [
  { id: 'INGESTION', label: 'Source received', icon: '1' },
  { id: 'EXTRACTING_AUDIO', label: 'Audio prepared', icon: '2' },
  { id: 'TRANSCRIBING', label: 'Transcript created', icon: '3' },
  { id: 'DIRECTING_CLIPS', label: 'Clips selected', icon: '4' },
  { id: 'RENDERING_CLIPS', label: 'Clips rendered', icon: '5' },
  { id: 'COMPLETED', label: 'Ready to review', icon: '6' },
];

export function renderProgressTracker(container) {
  function getStageIndex(currentStage) {
    const idx = STAGES.findIndex((s) => s.id === currentStage);
    return idx === -1 ? 0 : idx;
  }

  function update() {
    const progress = state.progress;
    const isVisible = state.isProcessing || ['COMPLETED', 'PARTIAL', 'FAILED'].includes(progress.stage);

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
      } else if (idx === currentIdx && progress.stage !== 'FAILED' && progress.stage !== 'PARTIAL') {
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
      ? progress.logs.map((l) => `<div class="log-entry"><span style="color: var(--text-muted);">[${escapeHtml(l.time)}]</span> <span class="stage">[${escapeHtml(l.stage)}]</span> ${escapeHtml(l.message)}</div>`).join('')
      : '<div class="log-entry" style="color: var(--text-muted);">Waiting for processing updates…</div>';

    container.innerHTML = `
      <div class="glass-panel progress-card" id="progress-section">
        <div class="progress-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="badge ${progress.stage === 'COMPLETED' ? 'badge-emerald' : progress.stage === 'FAILED' ? 'badge-rose' : 'badge-purple anim-pulse'}">
              ${escapeHtml(progress.stage || 'PROCESSING')}
            </div>
            <div style="font-weight: 700; font-size: 16px;">
              ${escapeHtml(progress.message || 'Processing your video…')}
            </div>
          </div>
          <div style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--primary);">
            ${progress.stage === 'FAILED' ? 'Stopped' : `${Math.round(progress.percent)}%`}
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar-wrap" ${progress.stage === 'FAILED' ? 'hidden' : ''}>
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
              Processing details
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
