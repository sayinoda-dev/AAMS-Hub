function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initReveal() {
  if (prefersReducedMotion()) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  document.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--reveal-delay', `${Math.min(i * 60, 360)}ms`);
    io.observe(el);
  });
}

function countUp(el) {
  const target = parseInt(el.getAttribute('data-count-up'), 10);
  if (Number.isNaN(target)) return;
  if (prefersReducedMotion()) {
    el.textContent = String(target);
    return;
  }
  const duration = 700;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCountUp() {
  if (prefersReducedMotion()) {
    document.querySelectorAll('[data-count-up]').forEach((el) => {
      el.textContent = el.getAttribute('data-count-up');
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          countUp(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll('[data-count-up]').forEach((el) => io.observe(el));
}

function initLineReveal() {
  const blocks = document.querySelectorAll('[data-line-reveal]');
  if (!blocks.length || prefersReducedMotion()) {
    blocks.forEach((b) => b.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  blocks.forEach((b) => io.observe(b));
}

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initCountUp();
  initLineReveal();
});

window.Animations = { initReveal, initCountUp, initLineReveal };
