import { initSupabase, getCurrentUser, loadUserAccessFromSupabase } from './supabase.js';

const status = document.querySelector('#payment-status');
const checkButton = document.querySelector('#check-payment');
let isChecking = false;

async function checkPayment({ retry = false } = {}) {
  if (isChecking) return;
  isChecking = true;
  checkButton.disabled = true;
  checkButton.querySelector('span').textContent = 'Confirming payment…';

  try {
    await initSupabase();
    const user = await getCurrentUser();
    if (!user) {
      status.textContent = 'Your payment may be complete, but you need to sign in before we can open your workspace.';
      return;
    }

    const attempts = retry ? 8 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const access = await loadUserAccessFromSupabase(user.user_id);
      if (access?.access_type === 'paid' && access?.is_active === true) {
        status.textContent = 'Subscription confirmed. Opening your workspace…';
        window.location.replace('app.html?payment=success');
        return;
      }
      if (attempt < attempts - 1) await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    status.textContent = 'Payment is still being confirmed. This usually takes a few seconds. You can check again safely.';
  } catch (error) {
    status.textContent = error.message || 'We could not confirm payment yet. Please check again.';
  } finally {
    isChecking = false;
    checkButton.disabled = false;
    checkButton.querySelector('span').textContent = 'Check payment status';
  }
}

checkButton?.addEventListener('click', () => checkPayment({ retry: true }));
checkPayment({ retry: true });
