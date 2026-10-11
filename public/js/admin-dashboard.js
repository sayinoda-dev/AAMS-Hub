document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('admin');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const newsRoot = document.getElementById('admin-news-list');

  try {
    const stats = await App.api('/api/admin/stats');
    document.querySelectorAll('[data-count-up]').forEach((el, i) => {
      const vals = [stats.pendingIdeas, stats.newsCount, stats.projectCount];
      el.setAttribute('data-count-up', String(vals[i] ?? 0));
    });
    Animations.initCountUp();
    Animations.initReveal();
  } catch (err) {
    console.error(err);
  }

  try {
    const data = await App.api('/api/news/manage');
    const items = data.news || [];
    if (!items.length) {
      newsRoot.innerHTML = '<p class="empty-state garamond">No news posts yet.</p>';
      return;
    }
    newsRoot.innerHTML = items
      .map(
        (n) => `
      <article class="admin-news-row" data-news-id="${n.id}">
        <div>
          <span class="meta-label">${App.escapeHtml(App.formatDate(n.published_at))}</span>
          <h3>${App.escapeHtml(n.title)}</h3>
          <p class="garamond">${App.escapeHtml(n.body.slice(0, 120))}${n.body.length > 120 ? '…' : ''}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--danger" data-delete-news="${n.id}">Delete</button>
      </article>`
      )
      .join('');

    newsRoot.querySelectorAll('[data-delete-news]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-news');
        if (!window.confirm('Delete this news post permanently?')) return;
        btn.disabled = true;
        try {
          await App.api(`/api/news/${id}`, { method: 'DELETE', body: {} });
          btn.closest('[data-news-id]')?.remove();
          if (!newsRoot.querySelector('[data-news-id]')) {
            newsRoot.innerHTML = '<p class="empty-state garamond">No news posts yet.</p>';
          }
        } catch (err) {
          alert(err.message || 'Could not delete.');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    newsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
  }
});
