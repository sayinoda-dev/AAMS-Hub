document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('master-form');
  if (!form) return;
  const errorEl = document.getElementById('master-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    const fd = new FormData(form);
    const username = String(fd.get('username') || '').trim();
    const password = String(fd.get('password') || '');
    if (!username || !password) {
      App.showInlineError(errorEl, 'Enter username and password.');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const data = await App.api('/api/auth/master-login', {
        method: 'POST',
        body: { username, password },
      });
      App.navigateWithFade(data.redirect || '/super/dashboard.html');
    } catch (err) {
      App.showInlineError(errorEl, err.message || 'Access denied.');
      btn.disabled = false;
    }
  });
});
