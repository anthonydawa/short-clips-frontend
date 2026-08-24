/**
 * Short Clips AI — Central Reactive State Store
 */

class AppState {
  constructor() {
    this.user = null;
    this.userAccess = null;
    this.brands = [];
    this.activeBrandId = null;
    this.jobs = [];
    this.activeJob = null;
    this.clips = [];
    this.selectedClip = null;
    this.analytics = null;
    this.isProcessing = false;
    this.progress = {
      stage: 'IDLE',
      percent: 0,
      message: '',
      logs: [],
    };

    this.listeners = new Set();
  }

  // Subscribe to state changes
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // Notify all subscribers
  notify(action, payload) {
    this.listeners.forEach((fn) => {
      try {
        fn(this, action, payload);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    });
  }

  setUser(user) {
    this.user = user;
    this.notify('USER_CHANGED', user);
  }

  setUserAccess(access) {
    this.userAccess = access || null;
    this.notify('USER_ACCESS_CHANGED', this.userAccess);
  }

  setBrands(brands) {
    this.brands = brands || [];
    if (!this.activeBrandId && this.brands.length > 0) {
      const defaultBrand = this.brands.find((b) => b.is_default) || this.brands[0];
      this.activeBrandId = defaultBrand.brand_id;
    }
    this.notify('BRANDS_UPDATED', this.brands);
  }

  setActiveBrand(brandId) {
    this.activeBrandId = brandId;
    this.notify('ACTIVE_BRAND_CHANGED', brandId);
  }

  getActiveBrand() {
    return this.brands.find((b) => b.brand_id === this.activeBrandId) || null;
  }

  setJobs(jobs) {
    this.jobs = jobs || [];
    this.notify('JOBS_UPDATED', this.jobs);
  }

  setActiveJob(job) {
    this.activeJob = job;
    this.notify('ACTIVE_JOB_CHANGED', job);
  }

  setClips(clips) {
    this.clips = clips || [];
    // Auto-select top viral clip if none selected
    if (this.clips.length > 0 && !this.selectedClip) {
      this.selectedClip = this.clips[0];
    }
    this.notify('CLIPS_UPDATED', this.clips);
  }

  setSelectedClip(clip) {
    this.selectedClip = clip;
    this.notify('SELECTED_CLIP_CHANGED', clip);
  }

  setAnalytics(analytics) {
    this.analytics = analytics || null;
    this.notify('ANALYTICS_UPDATED', this.analytics);
  }

  updateProgress(stage, percent, message, isLog = false) {
    this.progress.stage = stage;
    this.progress.percent = Math.min(100, Math.max(0, percent));
    this.progress.message = message;
    if (message && isLog) {
      this.progress.logs.push({
        time: new Date().toLocaleTimeString(),
        stage,
        message,
      });
    }
    this.isProcessing = stage !== 'COMPLETED' && stage !== 'FAILED' && stage !== 'IDLE';
    this.notify('PROGRESS_UPDATED', this.progress);
  }

  resetProgress() {
    this.progress = {
      stage: 'IDLE',
      percent: 0,
      message: '',
      logs: [],
    };
    this.isProcessing = false;
    this.notify('PROGRESS_RESET', this.progress);
  }

  clearUserData() {
    this.user = null;
    this.userAccess = null;
    this.brands = [];
    this.activeBrandId = null;
    this.jobs = [];
    this.activeJob = null;
    this.clips = [];
    this.selectedClip = null;
    this.analytics = null;
    this.resetProgress();
    this.notify('USER_CHANGED', null);
    this.notify('USER_ACCESS_CHANGED', null);
    this.notify('BRANDS_UPDATED', []);
    this.notify('CLIPS_UPDATED', []);
    this.notify('SELECTED_CLIP_CHANGED', null);
    this.notify('ANALYTICS_UPDATED', null);
  }
}

export const state = new AppState();
