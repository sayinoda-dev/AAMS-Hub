document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('admin');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const form = document.getElementById('news-form');
  const errorEl = document.getElementById('news-error');
  const successEl = document.getElementById('news-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    successEl.hidden = true;
    const title = form.title.value.trim();
    const body = form.body.value.trim();
    if (!title || !body) {
      App.showInlineError(errorEl, 'Headline and body are required.');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await App.api('/api/news', { method: 'POST', body: { title, body } });
      form.reset();
      successEl.textContent = 'Published. It is live on the student news board.';
      successEl.hidden = false;
    } catch (err) {
      App.showInlineError(errorEl, err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
