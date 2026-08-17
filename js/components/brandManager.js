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

  // 1. Render Brand Management Modal
  function renderBrandModal() {
    const brands = state.brands;
    const activeBrandId = state.activeBrandId;

    brandModal.innerHTML = `
      <div class="modal-card" style="max-width: 680px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="logo-icon" style="width: 32px; height: 32px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 style="font-size: 20px;">Brand Profiles & Directing Presets</h3>
          </div>
          <button id="btn-close-brand-modal" class="btn btn-ghost btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px;">
          <!-- Create / Edit Brand Form -->
          <form id="brand-form" style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary);">Create / Edit Brand</h4>
            
            <div class="setting-item">
              <label class="setting-label">Brand Name</label>
              <input type="text" id="bm-name" placeholder="e.g. Acme Media" required>
            </div>

            <div class="setting-item">
              <label class="setting-label">YouTube Channel URL</label>
              <input type="url" id="bm-channel" placeholder="https://youtube.com/@handle">
            </div>

            <div class="setting-item">
              <label class="setting-label">Niche / Category</label>
              <input type="text" id="bm-niche" placeholder="Finance, Fitness, Tech...">
            </div>

            <div class="setting-item">
              <label class="setting-label">Caption Style Preset</label>
              <select id="bm-preset">
                <option value="HORMOZI_BOLD">Hormozi Bold (Gold/Cyan)</option>
                <option value="MINIMAL_CLEAN">Minimal Clean (White Glow)</option>
                <option value="BEAST_KINETIC">MrBeast Kinetic (High Impact)</option>
              </select>
            </div>

            <div class="setting-item">
              <label class="setting-label">Target Audience</label>
              <input type="text" id="bm-audience" placeholder="Founders, creators, beginners">
            </div>

            <div class="setting-item">
              <label class="setting-label">Mandatory CTA</label>
              <input type="text" id="bm-cta" placeholder="Follow for daily tips">
            </div>

            <div class="setting-item">
              <label class="setting-label">AI Director Prompt Override</label>
              <textarea id="bm-prompt" rows="3" placeholder="Emphasize raw contrarian insights and snappy cuts..."></textarea>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 6px;">
              Save Brand Profile
            </button>
          </form>

          <!-- Existing Brands List -->
          <div style="border-left: 1px solid var(--border-glass); padding-left: 20px; display: flex; flex-direction: column; gap: 10px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary);">Saved Profiles</h4>
            ${brands.length === 0 ? '<div style="color: var(--text-muted); font-size: 13px;">No brand profiles yet.</div>' : ''}
            ${brands.map((b) => `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid ${b.brand_id === activeBrandId ? 'var(--primary)' : 'var(--border-glass)'}; border-radius: var(--radius-sm); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; font-size: 14px; color: ${b.brand_id === activeBrandId ? 'var(--primary)' : 'var(--text-primary)'};">${b.brand_name}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${b.niche || 'General'} • ${b.subtitle_preset || 'HORMOZI'}</div>
                </div>
                <button class="btn btn-sm btn-select-brand ${b.brand_id === activeBrandId ? 'btn-primary' : 'btn-ghost'}" data-id="${b.brand_id}">
                  ${b.brand_id === activeBrandId ? 'Active' : 'Select'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    brandModal.querySelector('#btn-close-brand-modal').addEventListener('click', () => {
      brandModal.classList.remove('active');
    });

    brandModal.querySelectorAll('.btn-select-brand').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.setActiveBrand(id);
        renderBrandModal(); // Re-render to update active styling
      });
    });

    brandModal.querySelector('#brand-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        brand_name: brandModal.querySelector('#bm-name').value,
        channel_url: brandModal.querySelector('#bm-channel').value,
        niche: brandModal.querySelector('#bm-niche').value,
        subtitle_preset: brandModal.querySelector('#bm-preset').value,
        target_audience: brandModal.querySelector('#bm-audience').value,
        mandatory_cta: brandModal.querySelector('#bm-cta').value,
        director_system_prompt: brandModal.querySelector('#bm-prompt').value,
        pacing_mode: 'snappy',
        remove_dead_space: true,
        enable_sfx: false,
        enable_top_banner: false,
      };

      try {
        let created = null;
        try {
          created = await api.createBrand(payload);
        } catch (apiErr) {
          console.warn('Backend brand create notice:', apiErr.message);
          created = { ...payload, brand_id: `brand_${Date.now()}` };
        }

        // Sync to cloud Supabase profile
        await syncBrandToSupabase(created);

        let updatedBrands = [];
        try {
          updatedBrands = await api.getBrands();
        } catch (e) {
          const user = state.user;
          const key = `shortclips_brands_${user?.user_id || 'dev_user'}`;
          updatedBrands = JSON.parse(localStorage.getItem(key) || '[]');
        }

        state.setBrands(updatedBrands.length > 0 ? updatedBrands : [created]);
        state.setActiveBrand(created.brand_id);
        brandModal.classList.remove('active');
      } catch (err) {
        alert('Failed to save brand: ' + err.message);
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
        alert('Channel Audit Failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Run AI Channel Audit 🔍';
      }
    });

    applyBtn.addEventListener('click', async () => {
      if (!lastAuditResult) return;
      try {
        let created = null;
        try {
          created = await api.createBrand(lastAuditResult);
        } catch (apiErr) {
          created = { ...lastAuditResult, brand_id: `brand_${Date.now()}` };
        }

        // Sync to cloud Supabase
        await syncBrandToSupabase(created);

        let updatedBrands = [];
        try {
          updatedBrands = await api.getBrands();
        } catch (e) {
          const user = state.user;
          const key = `shortclips_brands_${user?.user_id || 'dev_user'}`;
          updatedBrands = JSON.parse(localStorage.getItem(key) || '[]');
        }

        state.setBrands(updatedBrands.length > 0 ? updatedBrands : [created]);
        state.setActiveBrand(created.brand_id);
        auditModal.classList.remove('active');
        alert('Brand profile created and activated!');
      } catch (err) {
        alert('Error saving audited brand: ' + err.message);
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
