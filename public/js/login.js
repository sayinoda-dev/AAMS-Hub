document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  const cfg = window.CLUB_CONFIG || {};
  const logo = document.querySelector('[data-club-logo]');
  if (logo && cfg.logoSvg) logo.innerHTML = cfg.logoSvg;
  document.querySelectorAll('[data-club-name]').forEach((el) => {
    el.textContent = cfg.name || el.textContent;
  });

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  const roleInputs = form.querySelectorAll('input[name="role"]');
  const errorEl = document.getElementById('login-error');
  const gmailWarning = document.getElementById('gmail-warning');
  const emailLabel = document.getElementById('email-label');
  const emailInput = document.getElementById('email');

  function syncRoleUi() {
    const role = form.querySelector('input[name="role"]:checked')?.value || 'student';
    const isStudent = role === 'student';
    if (gmailWarning) gmailWarning.hidden = !isStudent;
    if (emailLabel) emailLabel.textContent = isStudent ? 'Gmail address' : 'Email';
    if (emailInput) {
      emailInput.placeholder = isStudent ? 'you@gmail.com' : '';
    }
  }

  roleInputs.forEach((input) => {
    input.addEventListener('change', () => {
      form.dataset.role = input.value;
      syncRoleUi();
    });
  });
  syncRoleUi();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const role = fd.get('role') === 'admin' ? 'admin' : 'student';

    if (!email || !password) {
      App.showInlineError(errorEl, 'Enter your email and password.');
      return;
    }
    if (role === 'student' && !App.isValidGmail(email)) {
      App.showInlineError(errorEl, 'Students must sign in with a valid @gmail.com address.');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const data = await App.api('/api/auth/login', {
        method: 'POST',
        body: { email, password, role },
      });
      const dest = next && next.startsWith('/') ? next : data.redirect;
      App.navigateWithFade(dest);
    } catch (err) {
      App.showInlineError(errorEl, err.message || 'Could not sign in.');
      btn.disabled = false;
    }
  });
});
