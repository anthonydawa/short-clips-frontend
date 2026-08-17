/**
 * Short Clips AI — Main Application Entry Point
 */

import { state } from './state.js';
import { api } from './api.js';
import { initSupabase, getCurrentUser, loadBrandsFromSupabase } from './supabase.js';

import { renderNavbar } from './components/navbar.js';
import { initAuthModal } from './components/authModal.js';
import { renderIngestionCard } from './components/ingestionCard.js';
import { renderProgressTracker } from './components/progressTracker.js';
import { renderClipStudio } from './components/clipStudio.js';
import { renderVerticalPlayer } from './components/verticalPlayer.js';
import { renderCaptionInspector } from './components/captionInspector.js';
import { initBrandManager } from './components/brandManager.js';
import { initAnalyticsModal } from './components/analyticsModal.js';

async function bootstrap() {
  console.log('🚀 Bootstrapping Short Clips AI Web App...');

  // 1. Initialize Supabase Auth
  await initSupabase();
  const currentUser = await getCurrentUser();
  state.setUser(currentUser);

  // 2. Initialize Modals
  initAuthModal();
  initBrandManager();
  initAnalyticsModal();

  // 3. Mount UI Components
  const navMount = document.getElementById('navbar-mount');
  const ingestionMount = document.getElementById('ingestion-mount');
  const progressMount = document.getElementById('progress-mount');
  const studioMount = document.getElementById('studio-mount');
  const playerMount = document.getElementById('player-mount');
  const inspectorMount = document.getElementById('inspector-mount');

  if (navMount) renderNavbar(navMount);
  if (ingestionMount) renderIngestionCard(ingestionMount);
  if (progressMount) renderProgressTracker(progressMount);
  if (studioMount) renderClipStudio(studioMount);
  if (playerMount) renderVerticalPlayer(playerMount);
  if (inspectorMount) renderCaptionInspector(inspectorMount);

  // 4. Fetch Brand Profiles (Cloud First -> Local Fallback)
  try {
    let brands = [];
    if (currentUser?.user_id) {
      brands = await loadBrandsFromSupabase(currentUser.user_id);
    }
    if (!brands || brands.length === 0) {
      brands = await api.getBrands();
    }
    if (brands && brands.length > 0) {
      state.setBrands(brands);
    }
  } catch (err) {
    console.warn('Could not fetch brands from cloud or API:', err);
  }

  console.log('✨ Short Clips AI Web App ready!');
}

// Start application once DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
