document.addEventListener('DOMContentLoaded', () => {
  const pin = document.querySelector('[data-scroll-pin]');
  const phrases = document.querySelectorAll('[data-pin-phrase]');
  const progress = document.querySelector('[data-scroll-progress]');
  const strip = document.querySelector('[data-h-scroll]');

  if (progress) {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      progress.style.transform = `scaleX(${pct / 100})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (pin && phrases.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const section = pin.closest('.pin-section') || pin.parentElement;
    const onScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = section.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const ratio = total > 0 ? scrolled / total : 0;
      const idx = Math.min(phrases.length - 1, Math.floor(ratio * phrases.length));
      phrases.forEach((p, i) => {
        p.classList.toggle('is-active', i === idx);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    phrases.forEach((p, i) => p.classList.toggle('is-active', i === 0));
  }

  if (strip) {
    fetch('/api/projects/public')
      .then((r) => r.json())
      .then((data) => {
        const projects = data.projects || [];
        if (!projects.length) {
          strip.innerHTML =
            '<p class="empty-state garamond">No projects on the board yet. Ideas become projects once approved.</p>';
          return;
        }
        strip.innerHTML = projects
          .map(
            (p) => `
          <article class="h-scroll-card" data-reveal>
            <span class="meta-label">Project</span>
            <h3>${App.escapeHtml(p.title)}</h3>
            <p>${App.escapeHtml(p.description.slice(0, 120))}${p.description.length > 120 ? '…' : ''}</p>
          </article>`
          )
          .join('');
        if (window.Animations) Animations.initReveal();
      })
      .catch(() => {});
  }

  const cfg = window.CLUB_CONFIG || {};
  document.querySelectorAll('[data-club-name]').forEach((el) => {
    el.textContent = cfg.name || el.textContent;
  });
  document.querySelectorAll('[data-club-tagline]').forEach((el) => {
    el.textContent = cfg.tagline || el.textContent;
  });
  const logo = document.querySelector('[data-club-logo]');
  if (logo && cfg.logoSvg) logo.innerHTML = cfg.logoSvg;
});
