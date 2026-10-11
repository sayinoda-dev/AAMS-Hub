const FOOTER_SVG = {
  instagram: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z"/></svg>`,
  telegram: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M21.5 3.5L2.8 10.6c-1.1.45-1.08 1.05-.18 1.35l4.78 1.5 1.84 5.58c.23.7.55.88 1.12.88.48 0 .7-.22.97-.48l2.2-2.12 4.58 3.38c.84.47 1.45.23 1.66-.8L23 5.2c.28-1.15-.42-1.67-1.5-1.7z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.8v2h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.07V23h-4v-6.8c0-1.62-.03-3.7-2.25-3.7-2.25 0-2.6 1.76-2.6 3.57V23h-4V8.5z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.5 3c.6 3.2 2.6 5.1 5.5 5.4v4.1c-2 0-3.8-.6-5.5-1.7v7.4c0 4.5-3.2 7.5-7.2 7.5-3.7 0-6.3-2.5-6.3-6 0-3.4 2.6-5.8 6.1-5.8.6 0 1.2.1 1.8.2v4.2c-.5-.2-1-.3-1.5-.3-1.6 0-2.7 1-2.7 2.6 0 1.5 1.1 2.5 2.7 2.5 1.7 0 2.8-1.1 2.8-3.1V3h4.3z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.76.41-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 012.87-.39c.97 0 1.95.13 2.87.39 2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.76.12 3.05.73.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.42.36.79 1.07.79 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>`,
};

function mountGlobalFooter() {
  if (document.querySelector('[data-global-footer]')) return;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.setAttribute('data-global-footer', '');
  footer.innerHTML = `
    <div class="site-footer__inner">
      <p class="site-footer__bio garamond">
        Created by Adoniyas Sintayehu, a Grade 11 student at Akaki Adventist Mission School,
        who is passionate about solving real-world problems.
      </p>
      <nav class="site-footer__social" aria-label="Social links">
        <a href="#" aria-label="Instagram">${FOOTER_SVG.instagram}</a>
        <a href="#" aria-label="Telegram">${FOOTER_SVG.telegram}</a>
        <a href="#" aria-label="LinkedIn">${FOOTER_SVG.linkedin}</a>
        <a href="#" aria-label="TikTok">${FOOTER_SVG.tiktok}</a>
        <a href="#" aria-label="GitHub">${FOOTER_SVG.github}</a>
      </nav>
    </div>`;
  document.body.appendChild(footer);
}

window.mountGlobalFooter = mountGlobalFooter;
