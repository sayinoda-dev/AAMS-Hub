function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimMax(str, max) {
  const s = String(str || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Local part + @gmail.com only (case-insensitive domain). */
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?@gmail\.com$/i;

function isValidEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 255;
}

function isValidGmail(email) {
  if (!email || email.length > 255) return false;
  const normalized = String(email).trim().toLowerCase();
  return GMAIL_RE.test(normalized);
}

module.exports = { escapeHtml, trimMax, isValidEmail, isValidGmail };
