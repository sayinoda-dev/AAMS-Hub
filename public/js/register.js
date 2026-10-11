document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('register-form');
  if (!form) return;

  const cfg = window.CLUB_CONFIG || {};
  const logo = document.querySelector('[data-club-logo]');
  if (logo && cfg.logoSvg) logo.innerHTML = cfg.logoSvg;
  document.querySelectorAll('[data-club-name]').forEach((el) => {
    el.textContent = cfg.name || el.textContent;
  });

  const errorEl = document.getElementById('register-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');

    if (!name || name.length < 2) {
      App.showInlineError(errorEl, 'Enter your full name.');
      return;
    }
    if (!App.isValidGmail(email)) {
      App.showInlineError(errorEl, 'Use a valid @gmail.com address.');
      return;
    }
    if (password.length < 8) {
      App.showInlineError(errorEl, 'Password must be at least 8 characters.');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const data = await App.api('/api/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      App.navigateWithFade(data.redirect || '/student/news.html');
    } catch (err) {
      App.showInlineError(errorEl, err.message || 'Could not create account.');
      btn.disabled = false;
    }
  });
});
