import { api } from './api.js';
import { signUpWithEmail } from './supabase.js';

const form = document.querySelector('#pilot-form');
const status = document.querySelector('#form-status');
const signupSource = document.body.dataset.signupSource || 'paid_signup';
const isFreeTrial = signupSource === 'free_trial_request';
const defaultButtonLabel = isFreeTrial ? 'Build my pilot workspace' : 'Create my account — $19.96';

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
      signup_source: signupSource,
      first_name: pilotPayload.first_name,
      last_name: pilotPayload.last_name,
      company: pilotPayload.company,
      channel_url: pilotPayload.channel_url,
    });
    let applicationId = null;
    if (isFreeTrial) {
      const result = await api.applyForPilot(pilotPayload);
      applicationId = result.application_id;
    }
    const storageKey = isFreeTrial ? 'shoort_clips_pilot' : 'shoort_clips_signup';
    localStorage.setItem(storageKey, JSON.stringify({ ...pilotPayload, application_id: applicationId, signup_source: signupSource, created_at: new Date().toISOString() }));
    if (signup?.session && signup?.user) {
      window.location.href = 'app.html?welcome=1';
      return;
    }
    status.textContent = 'Account created. Check your email to confirm it, then sign in to open your workspace.';
  } catch (error) {
    status.textContent = error.message || 'We could not create the workspace. Please try again.';
  }
  button.disabled = false;
  button.querySelector('span').textContent = defaultButtonLabel;
});
