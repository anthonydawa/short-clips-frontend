/**
 * Short Clips AI — Brand Manager & AI Channel Auditor Component
 */

import { state } from '../state.js';
import { api } from '../api.js';
import { syncBrandToSupabase, syncAuditToSupabase } from '../supabase.js';

export function initBrandManager() {
  const brandModal = document.getElementById('brand-modal');
  const auditModal = document.getElementById('auditor-modal');
  if (!brandModal || !auditModal) return;

  // 1. Render Single Brand Profile Modal
  function renderBrandModal() {
    const brand = state.getActiveBrand() || {
      brand_id: 'default_brand',
      brand_name: 'My Brand',
      channel_url: '',
      niche: 'Creator & Media',
      subtitle_preset: 'HORMOZI_BOLD',
      target_audience: '',
      mandatory_cta: '',
      director_system_prompt: '',
    };

    brandModal.innerHTML = `
      <div class="modal-card" style="max-width: 580px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="logo-icon" style="width: 32px; height: 32px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 style="font-size: 20px;">Brand Profile & Directing Presets</h3>
          </div>
          <button id="btn-close-brand-modal" class="btn btn-ghost btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="brand-form" style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="setting-item">
              <label class="setting-label">Brand / Channel Name</label>
              <input type="text" id="bm-name" value="${brand.brand_name || ''}" placeholder="e.g. My Brand" required>
            </div>

            <div class="setting-item">
              <label class="setting-label">YouTube Channel URL</label>
              <input type="url" id="bm-channel" value="${brand.channel_url || ''}" placeholder="https://youtube.com/@handle">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="setting-item">
              <label class="setting-label">Niche / Industry</label>
              <input type="text" id="bm-niche" value="${brand.niche || ''}" placeholder="Finance, Fitness, Tech...">
            </div>

            <div class="setting-item">
              <label class="setting-label">Default Caption Style</label>
              <select id="bm-preset">
                <option value="HORMOZI_BOLD" ${brand.subtitle_preset === 'HORMOZI_BOLD' || brand.subtitle_preset === 'hormozi' ? 'selected' : ''}>🔥 Hormozi Bold (Electric Yellow)</option>
                <option value="MINIMAL_CLEAN" ${brand.subtitle_preset === 'MINIMAL_CLEAN' || brand.subtitle_preset === 'clean' ? 'selected' : ''}>✨ Clean (Minimal Neon Cyan)</option>
                <option value="BEAST_KINETIC" ${brand.subtitle_preset === 'BEAST_KINETIC' || brand.subtitle_preset === 'beast' ? 'selected' : ''}>🏆 Beast Kinetic (High Impact)</option>
                <option value="TECH_MATRIX" ${brand.subtitle_preset === 'TECH_MATRIX' || brand.subtitle_preset === 'tech' ? 'selected' : ''}>⚡ Tech Monospace</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="setting-item">
              <label class="setting-label">Target Audience</label>
              <input type="text" id="bm-audience" value="${brand.target_audience || ''}" placeholder="e.g. Founders, students, fitness lovers">
            </div>

            <div class="setting-item">
              <label class="setting-label">Mandatory CTA (Call to Action)</label>
              <input type="text" id="bm-cta" value="${brand.mandatory_cta || ''}" placeholder="e.g. Link in bio / Subscribe for more">
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">AI Directing System Prompt Override (Optional)</label>
            <textarea id="bm-prompt" rows="2" placeholder="Custom AI instructions to steer video pacing, hook detection, and clip selection...">${brand.director_system_prompt || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
            <button type="button" id="btn-cancel-brand" class="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" style="padding: 8px 18px;">
              💾 Save Brand Profile
            </button>
          </div>
        </form>
      </div>
    `;

    brandModal.querySelector('#btn-close-brand-modal').addEventListener('click', () => {
      brandModal.classList.remove('active');
    });

    brandModal.querySelector('#btn-cancel-brand').addEventListener('click', () => {
      brandModal.classList.remove('active');
    });

    brandModal.querySelector('#brand-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updatedBrand = {
        brand_id: brand.brand_id || `brand_${Date.now()}`,
        brand_name: brandModal.querySelector('#bm-name').value.trim() || 'My Brand',
        channel_url: brandModal.querySelector('#bm-channel').value.trim(),
        niche: brandModal.querySelector('#bm-niche').value.trim(),
        subtitle_preset: brandModal.querySelector('#bm-preset').value,
        target_audience: brandModal.querySelector('#bm-audience').value.trim(),
        mandatory_cta: brandModal.querySelector('#bm-cta').value.trim(),
        director_system_prompt: brandModal.querySelector('#bm-prompt').value.trim(),
        pacing_mode: 'snappy',
        remove_dead_space: true,
        enable_sfx: false,
        enable_top_banner: false,
        is_default: true,
      };

      try {
        // Try backend create / update
        try {
          await api.createBrand(updatedBrand);
        } catch (apiErr) {
          console.warn('Backend brand sync notice:', apiErr.message);
        }

        // Sync to cloud Supabase profile
        await syncBrandToSupabase(updatedBrand);

        state.setBrands([updatedBrand]);
        state.setActiveBrand(updatedBrand.brand_id);
        brandModal.classList.remove('active');
      } catch (err) {
        console.warn('Failed to save brand:', err.message);
      }
    });
  }

  // 2. Render AI Channel Auditor Modal
  function renderAuditorModal() {
    auditModal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="logo-icon" style="width: 32px; height: 32px; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
            </div>
            <h3 style="font-size: 20px;">AI YouTube Channel Auditor</h3>
          </div>
          <button id="btn-close-auditor-modal" class="btn btn-ghost btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; line-height: 1.5;">
          Enter any YouTube channel URL or @handle. The AI Auditor will analyze recent videos, metadata, and audience tone to synthesize an optimal Brand Profile and Director Prompt.
        </p>

        <form id="auditor-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="setting-item">
            <label class="setting-label">YouTube Channel URL or Handle</label>
            <input type="text" id="audit-channel-url" placeholder="https://www.youtube.com/@AlexHormozi" required>
          </div>
          <div class="setting-item">
            <label class="setting-label">Additional Brand Focus (Optional)</label>
            <input type="text" id="audit-context" placeholder="Focus on business scaling and sales lessons">
          </div>

          <button type="submit" id="btn-run-audit" class="btn btn-accent btn-lg" style="margin-top: 6px;">
            Run AI Channel Audit 🔍
          </button>
        </form>

        <div id="audit-results-card" style="display: none; margin-top: 24px; background: rgba(11, 17, 33, 0.8); border: 1px solid var(--border-glass-glow); border-radius: var(--radius-md); padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="badge badge-emerald">Audit Synthesized</div>
            <button id="btn-apply-audit" class="btn btn-primary btn-sm">Apply to Active Brand</button>
          </div>
          <div id="audit-content-preview" style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;"></div>
        </div>
      </div>
    `;

    auditModal.querySelector('#btn-close-auditor-modal').addEventListener('click', () => {
      auditModal.classList.remove('active');
    });

    const auditorForm = auditModal.querySelector('#auditor-form');
    const resultCard = auditModal.querySelector('#audit-results-card');
    const preview = auditModal.querySelector('#audit-content-preview');
    const applyBtn = auditModal.querySelector('#btn-apply-audit');
    let lastAuditResult = null;
    let auditedChannelUrl = '';
    let auditedContext = '';

    auditorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const channelUrl = auditModal.querySelector('#audit-channel-url').value;
      const context = auditModal.querySelector('#audit-context').value;
      const btn = auditModal.querySelector('#btn-run-audit');

      auditedChannelUrl = channelUrl;
      auditedContext = context;

      btn.disabled = true;
      btn.innerHTML = '<span class="anim-spin">⚡</span> Auditing Channel...';

      try {
        const result = await api.analyzeChannel(channelUrl, context);
        lastAuditResult = result;
        resultCard.style.display = 'block';
        preview.innerHTML = `
          <div><strong>Brand Name:</strong> ${result.brand_name}</div>
          <div><strong>Niche:</strong> ${result.niche}</div>
          <div><strong>Tone:</strong> ${result.tone_of_voice}</div>
          <div><strong>Target Audience:</strong> ${result.target_audience}</div>
          <div><strong>Mandatory CTA:</strong> ${result.mandatory_cta}</div>
          <div style="margin-top: 6px;"><strong>Director Prompt:</strong> ${result.director_system_prompt}</div>
        `;

        // Save audit snapshot to Supabase
        await syncAuditToSupabase(result, channelUrl, context);
      } catch (err) {
        console.warn('Channel Audit notice:', err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Run AI Channel Audit 🔍';
      }
    });

    applyBtn.addEventListener('click', async () => {
      if (!lastAuditResult) return;
      try {
        const existingBrand = state.getActiveBrand();
        const appliedBrand = {
          brand_id: existingBrand?.brand_id || `brand_${Date.now()}`,
          brand_name: lastAuditResult.brand_name || 'Audited Brand',
          channel_url: auditedChannelUrl || lastAuditResult.channel_url || '',
          niche: lastAuditResult.niche || '',
          subtitle_preset: lastAuditResult.subtitle_preset || 'HORMOZI_BOLD',
          target_audience: lastAuditResult.target_audience || '',
          mandatory_cta: lastAuditResult.mandatory_cta || '',
          director_system_prompt: lastAuditResult.director_system_prompt || '',
          pacing_mode: 'snappy',
          remove_dead_space: true,
          enable_sfx: false,
          enable_top_banner: false,
          is_default: true,
        };

        try {
          await api.createBrand(appliedBrand);
        } catch (apiErr) {
          console.warn('Backend brand sync notice:', apiErr.message);
        }

        // Sync to cloud Supabase
        await syncBrandToSupabase(appliedBrand);

        state.setBrands([appliedBrand]);
        state.setActiveBrand(appliedBrand.brand_id);
        auditModal.classList.remove('active');
      } catch (err) {
        console.warn('Error saving audited brand:', err.message);
      }
    });
  }

  renderBrandModal();
  renderAuditorModal();

  window.addEventListener('OPEN_BRAND_MANAGER', () => {
    if (!state.user) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      return;
    }
    renderBrandModal();
    brandModal.classList.add('active');
  });

  window.addEventListener('OPEN_CHANNEL_AUDITOR', () => {
    if (!state.user) {
      window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
      return;
    }
    renderAuditorModal();
    auditModal.classList.add('active');
  });
}
