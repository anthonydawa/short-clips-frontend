/**
 * Short Clips AI — Supabase Auth Modal Component
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../supabase.js';

export function initAuthModal() {
  const modalEl = document.getElementById('auth-modal');
  if (!modalEl) return;

  function render() {
    modalEl.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="auth-heading-group">
            <div class="logo-icon" style="width: 32px; height: 32px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </div>
            <div><h3>Sign in to Shoort Clips</h3><p>Access your clips, channel data, and schedule.</p></div>
          </div>
          <button id="btn-close-auth-modal" class="btn btn-ghost btn-icon" type="button" aria-label="Close sign-in dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Google OAuth Button -->
        <div style="margin-bottom: 24px;">
          <button id="btn-google-login" class="btn btn-lg" style="width: 100%; background: #ffffff; color: #1f2937; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(0,0,0,0.3); font-weight: 700; gap: 12px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.25-.93 2.3-1.99 3.02v2.51h3.22c1.88-1.73 2.97-4.28 2.97-7.24 0-.43-.04-.86-.1-1.27z" fill="#4285F4"/>
              <path d="M12.18 21c2.7 0 4.96-.9 6.61-2.43l-3.22-2.51c-.89.6-2.03.96-3.39.96-2.61 0-4.81-1.76-5.6-4.13H3.25v2.59C4.89 18.73 8.27 21 12.18 21z" fill="#34A853"/>
              <path d="M6.58 12.89c-.2-.6-.31-1.25-.31-1.89s.11-1.29.31-1.89V6.52H3.25C2.58 7.86 2.18 9.39 2.18 11s.4 3.14 1.07 4.48l3.33-2.59z" fill="#FBBC05"/>
              <path d="M12.18 5.08c1.47 0 2.78.51 3.82 1.5l2.86-2.86C17.13 2.1 14.88 1.18 12.18 1.18 8.27 1.18 4.89 3.45 3.25 6.52l3.33 2.59c.79-2.37 2.99-4.13 5.6-4.13z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; height: 1px; background: var(--border-glass);"></div>
          <span style="color: var(--text-muted); font-size: 12px; text-transform: uppercase;">Or with email</span>
          <div style="flex: 1; height: 1px; background: var(--border-glass);"></div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border-glass); padding-bottom: 10px;">
          <button id="tab-sign-in" type="button" class="btn btn-sm btn-primary" style="flex: 1;">Sign in</button>
          <button id="tab-sign-up" type="button" class="btn btn-sm btn-ghost" style="flex: 1;">Create account</button>
        </div>

        <!-- Email & Password Form -->
        <form id="email-auth-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="setting-item">
            <label class="setting-label" for="auth-email">Email address</label>
            <input type="email" id="auth-email" placeholder="creator@example.com" required>
          </div>
          <div class="setting-item">
            <label class="setting-label" for="auth-password">Password</label>
            <input type="password" id="auth-password" placeholder="••••••••" required>
          </div>
          <button type="submit" id="btn-submit-email-auth" class="btn btn-primary" style="margin-top: 6px;">Sign in</button>
        </form>
        <div id="auth-status" role="status" aria-live="polite" style="min-height: 18px; margin-top: 12px; color: var(--text-muted); font-size: 12px;"></div>
      </div>
    `;

    let isSignUpMode = false;
    const tabSignIn = modalEl.querySelector('#tab-sign-in');
    const tabSignUp = modalEl.querySelector('#tab-sign-up');
    const submitBtn = modalEl.querySelector('#btn-submit-email-auth');
    const statusEl = modalEl.querySelector('#auth-status');

    tabSignIn.addEventListener('click', () => {
      isSignUpMode = false;
      tabSignIn.className = 'btn btn-sm btn-primary';
      tabSignUp.className = 'btn btn-sm btn-ghost';
      submitBtn.textContent = 'Sign in';
    });

    tabSignUp.addEventListener('click', () => {
      isSignUpMode = true;
      tabSignUp.className = 'btn btn-sm btn-primary';
      tabSignIn.className = 'btn btn-sm btn-ghost';
      submitBtn.textContent = 'Create account';
    });

    // Event Listeners
    modalEl.querySelector('#btn-close-auth-modal').addEventListener('click', () => {
      modalEl.classList.remove('active');
    });

    modalEl.querySelector('#btn-google-login').addEventListener('click', async () => {
      try {
        const user = await signInWithGoogle();
        if (user) {
          state.setUser(user);
        }
        modalEl.classList.remove('active');
      } catch (err) {
        statusEl.textContent = err.message || 'Google sign-in could not be started.';
        console.warn('Google Sign-In notice:', err.message);
      }
    });

    modalEl.querySelector('#email-auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = modalEl.querySelector('#auth-email').value;
      const pass = modalEl.querySelector('#auth-password').value;
      statusEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="anim-spin"></span> Please wait…';

      try {
        if (isSignUpMode) {
          const signup = await signUpWithEmail(email, pass, { signup_source: 'direct' });
          if (signup?.session && signup?.user) state.setUser(signup.user);
          if (!signup?.session) {
            statusEl.textContent = 'Account created. Check your email to confirm it, then sign in.';
            return;
          }
        } else {
          const user = await signInWithEmail(email, pass);
          if (user) state.setUser(user);
        }
        modalEl.classList.remove('active');
      } catch (err) {
        statusEl.textContent = err.message || 'Authentication failed. Please try again.';
        console.warn((isSignUpMode ? 'Sign Up' : 'Sign In') + ' notice:', err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUpMode ? 'Create account' : 'Sign in';
      }
    });
  }

  render();

  window.addEventListener('OPEN_AUTH_MODAL', () => {
    modalEl.classList.add('active');
  });
}
