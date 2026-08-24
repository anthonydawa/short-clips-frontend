import { api } from './api.js';
import { signUpWithEmail } from './supabase.js';

const form = document.querySelector('#pilot-form');
const status = document.querySelector('#form-status');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  const { password, password_confirmation: passwordConfirmation, ...pilotPayload } = payload;
  if (password !== passwordConfirmation) {
    status.textContent = 'Passwords do not match.';
    return;
  }
  button.disabled = true;
  button.querySelector('span').textContent = 'Creating your account…';
  status.textContent = '';
  try {
    const signup = await signUpWithEmail(payload.email, password, {
      signup_source: 'free_trial_request',
      first_name: pilotPayload.first_name,
      last_name: pilotPayload.last_name,
      company: pilotPayload.company,
      channel_url: pilotPayload.channel_url,
    });
    const result = await api.applyForPilot(pilotPayload);
    localStorage.setItem('shoort_clips_pilot', JSON.stringify({ ...pilotPayload, application_id: result.application_id, created_at: new Date().toISOString() }));
    if (signup?.session && signup?.user) {
      window.location.href = 'app.html?welcome=1';
      return;
    }
    status.textContent = 'Account created. Check your email to confirm it, then sign in to open your workspace.';
  } catch (error) {
    status.textContent = error.message || 'We could not create the workspace. Please try again.';
  }
  button.disabled = false;
  button.querySelector('span').textContent = 'Build my pilot workspace';
});
