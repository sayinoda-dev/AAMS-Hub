function renderNewsImages(images) {
  if (!images?.length) return '';
  return `<div class="news-gallery">${images
    .map(
      (img) =>
        `<img src="${App.escapeHtml(img.url)}" alt="" loading="lazy" width="480" height="320" />`
    )
    .join('')}</div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('student');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const root = document.getElementById('news-root');
  try {
    const data = await App.api('/api/news');
    const items = data.news || [];
    if (!items.length) {
      root.innerHTML = '<p class="empty-state garamond">Nothing published yet. Check back soon.</p>';
      return;
    }

    const [featured, ...rest] = items;
    root.innerHTML = `
      <div class="card-grid card-grid--asymmetric">
        <article class="featured-news" data-reveal>
          <span class="meta-label">Featured · ${App.escapeHtml(App.formatDate(featured.published_at))}</span>
          <h2>${App.escapeHtml(featured.title)}</h2>
          ${renderNewsImages(featured.images)}
          <p class="news-body">${App.escapeHtml(featured.body)}</p>
          <p class="meta-label" style="margin-top: var(--space-md)">By ${App.escapeHtml(featured.author_name || 'Club')}</p>
        </article>
        <div class="news-list">
          ${rest
            .map(
              (n, i) => `
            <article data-reveal style="--reveal-delay: ${i * 50}ms">
              <span class="meta-label">${App.escapeHtml(App.formatDate(n.published_at))}</span>
              <h3>${App.escapeHtml(n.title)}</h3>
              ${renderNewsImages(n.images)}
              <p>${App.escapeHtml(n.body.slice(0, 160))}${n.body.length > 160 ? '…' : ''}</p>
            </article>`
            )
            .join('')}
        </div>
      </div>`;
    Animations.initReveal();
  } catch (err) {
    root.innerHTML = `<p class="form-error" role="alert">${App.escapeHtml(err.message)}</p>`;
  }
});
