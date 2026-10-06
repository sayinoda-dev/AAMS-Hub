document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('student');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const form = document.getElementById('idea-form');
  const errorEl = document.getElementById('idea-error');
  const successEl = document.getElementById('idea-success');
  const myIdeas = document.getElementById('my-ideas');

  async function loadMine() {
    try {
      const data = await App.api('/api/ideas/mine');
      const ideas = data.ideas || [];
      if (!ideas.length) {
        myIdeas.innerHTML =
          '<p class="empty-state garamond">You have not submitted any ideas yet.</p>';
        return;
      }
      myIdeas.innerHTML = ideas
        .map(
          (i) => `
        <article class="card" data-reveal style="margin-bottom: var(--space-sm)">
          <span class="meta-label">${App.escapeHtml(i.status)} · ${App.escapeHtml(App.formatDate(i.created_at))}</span>
          <h3 style="font-weight:500;margin:0.35rem 0">${App.escapeHtml(i.title)}</h3>
          <p>${App.escapeHtml(i.description.slice(0, 200))}${i.description.length > 200 ? '…' : ''}</p>
        </article>`
        )
        .join('');
      Animations.initReveal();
    } catch (err) {
      myIdeas.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  loadMine();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    successEl.hidden = true;
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    if (!title) {
      App.showInlineError(errorEl, 'Add a title for your idea.');
      return;
    }
    if (description.length < 20) {
      App.showInlineError(errorEl, 'Add a bit more detail (at least 20 characters).');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await App.api('/api/ideas', { method: 'POST', body: { title, description } });
      form.reset();
      successEl.textContent = 'Your idea is in the review queue. We will post it here when it is decided.';
      successEl.hidden = false;
      loadMine();
    } catch (err) {
      App.showInlineError(errorEl, err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
