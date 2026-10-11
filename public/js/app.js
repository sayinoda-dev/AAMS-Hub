let csrfTokenCache = null;

async function fetchCsrfToken() {
  const res = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('csrf');
  const data = await res.json();
  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  return fetchCsrfToken();
}

async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    headers['CSRF-Token'] = await getCsrfToken();
  }
  const res = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setPageEnter() {
  document.documentElement.classList.add('page-enter');
  requestAnimationFrame(() => {
    document.documentElement.classList.add('page-enter-active');
  });
}

function navigateWithFade(url) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.href = url;
    return;
  }
  document.documentElement.classList.add('page-exit');
  setTimeout(() => {
    window.location.href = url;
  }, 180);
}

const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?@gmail\.com$/i;

function isValidGmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return GMAIL_RE.test(normalized);
}

async function requireSession(role) {
  const data = await api('/api/auth/me');
  if (!data.user) {
    navigateWithFade('/login.html?next=' + encodeURIComponent(window.location.pathname));
    return null;
  }
  if (role === 'superadmin') {
    if (data.user.role !== 'superadmin') {
      navigateWithFade('/login.html');
      return null;
    }
    return data.user;
  }
  if (data.user.role === 'superadmin') {
    navigateWithFade('/super/dashboard.html');
    return null;
  }
  if (role && data.user.role !== role) {
    navigateWithFade(data.user.role === 'admin' ? '/admin/dashboard.html' : '/student/news.html');
    return null;
  }
  return data.user;
}

async function initHeaderSession() {
  try {
    const data = await api('/api/auth/me');
    if (!data.user) return;
    document.querySelectorAll('[data-header-user]').forEach((el) => {
      el.textContent = data.user.name;
      el.hidden = false;
    });
    document.querySelectorAll('[data-user-name]').forEach((el) => {
      el.textContent = data.user.name;
    });
  } catch (_) {
    /* public page */
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST', body: {} });
  } catch (_) {
    /* still redirect */
  }
  navigateWithFade('/login.html');
}

function showInlineError(el, message) {
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
}

function bindNavCompact() {
  const nav = document.querySelector('[data-compact-nav]');
  if (!nav) return;
  let last = 0;
  const onScroll = () => {
    const y = window.scrollY;
    if (y > 48 && y > last) nav.classList.add('is-compact');
    else if (y < 24) nav.classList.remove('is-compact');
    last = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  setPageEnter();
  fetchCsrfToken().catch(() => {});
  if (typeof window.mountGlobalFooter === 'function') window.mountGlobalFooter();
  initHeaderSession().catch(() => {});

  document.querySelectorAll('[data-nav-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;
      e.preventDefault();
      navigateWithFade(href);
    });
  });

  const logoutBtn = document.querySelector('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  bindNavCompact();
});

window.App = {
  api,
  escapeHtml,
  formatDate,
  formatDateTime,
  requireSession,
  logout,
  showInlineError,
  navigateWithFade,
  getCsrfToken,
  isValidGmail,
};
