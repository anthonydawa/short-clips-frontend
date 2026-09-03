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
    this.editingClip = null;
    this.analytics = null;
    this.isProcessing = false;
    let storedAutopilot = false;
    try {
      storedAutopilot = localStorage.getItem('shoort_clips_autopilot') === 'true';
    } catch (_) {}
    this.autopilot = storedAutopilot;
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

  setAutopilot(enabled) {
    this.autopilot = Boolean(enabled);
    try {
      localStorage.setItem('shoort_clips_autopilot', String(this.autopilot));
    } catch (_) {}
    this.notify('AUTOPILOT_CHANGED', this.autopilot);
    if (this.autopilot) {
      this.autoApproveReadyClips();
    }
  }

  approveClip(clipUid, scheduledAt = null) {
    const clip = this.clips.find((c) => String(c.clip_uid || c.clip_id) === String(clipUid));
    if (!clip) return null;
    clip.status = 'approved';
    clip.approved_version = clip.version || 1;
    if (!clip.scheduled_at) {
      clip.scheduled_at = scheduledAt || new Date(Date.now() + 86400000).toISOString();
    }
    this.notify('CLIPS_UPDATED', this.clips);
    this.notify('CLIP_APPROVED', clip);
    return clip;
  }

  rejectClip(clipUid) {
    const clip = this.clips.find((c) => String(c.clip_uid || c.clip_id) === String(clipUid));
    if (!clip) return null;
    clip.status = 'rejected';
    this.notify('CLIPS_UPDATED', this.clips);
    this.notify('CLIP_REJECTED', clip);
    return clip;
  }

  autoApproveReadyClips() {
    let changed = false;
    const now = Date.now();
    let slotIndex = 1;
    this.clips.forEach((clip) => {
      const status = String(clip.status || 'ready').toLowerCase();
      if (status !== 'approved' && status !== 'scheduled' && status !== 'rejected') {
        clip.status = 'approved';
        clip.approved_version = clip.version || 1;
        if (!clip.scheduled_at) {
          clip.scheduled_at = new Date(now + slotIndex * 86400000).toISOString();
          slotIndex++;
        }
        changed = true;
      }
    });
    if (changed) {
      this.notify('CLIPS_UPDATED', this.clips);
      this.notify('AUTOPILOT_AUTO_APPROVED', this.clips);
    }
  }

  setClips(clips) {
    this.clips = clips || [];
    if (this.autopilot) {
      this.autoApproveReadyClips();
    }
    // Preserve the selection with fresh URLs, or select the new batch's first
    // clip. Never keep an object from a different/cleared job in the player.
    const previous = this.selectedClip;
    this.selectedClip = this.clips.find((clip) => previous && (
      (clip.clip_uid && clip.clip_uid === previous.clip_uid) ||
      (clip.video_id && clip.video_id === previous.video_id && clip.clip_id != null && clip.clip_id === previous.clip_id)
    )) || this.clips[0] || null;
    this.notify('CLIPS_UPDATED', this.clips);
    this.notify('SELECTED_CLIP_CHANGED', this.selectedClip);
  }

  setSelectedClip(clip) {
    this.selectedClip = clip;
    this.notify('SELECTED_CLIP_CHANGED', clip);
  }

  setEditingClip(clip) {
    this.editingClip = clip;
    this.notify('EDITING_CLIP_CHANGED', clip);
  }

  updateClip(updatedClip) {
    if (!updatedClip) return;
    const uid = String(updatedClip.clip_uid || updatedClip.clip_id);
    const idx = this.clips.findIndex((c) => String(c.clip_uid || c.clip_id) === uid);
    if (idx !== -1) {
      this.clips[idx] = { ...this.clips[idx], ...updatedClip };
    } else {
      this.clips.unshift(updatedClip);
    }
    if (this.selectedClip && String(this.selectedClip.clip_uid || this.selectedClip.clip_id) === uid) {
      this.selectedClip = { ...this.selectedClip, ...updatedClip };
      this.notify('SELECTED_CLIP_CHANGED', this.selectedClip);
    }
    if (this.editingClip && String(this.editingClip.clip_uid || this.editingClip.clip_id) === uid) {
      this.editingClip = { ...this.editingClip, ...updatedClip };
      this.notify('EDITING_CLIP_CHANGED', this.editingClip);
    }
    this.notify('CLIPS_UPDATED', this.clips);
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
    this.isProcessing = !['COMPLETED', 'PARTIAL', 'FAILED', 'IDLE'].includes(stage);
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
