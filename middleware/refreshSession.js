const { query } = require('../db/pool');
const { applySessionClub } = require('../lib/club');

const IDENTITY_KEYS = [
  'userId',
  'userName',
  'userEmail',
  'role',
  'superAdmin',
  'clubId',
  'clubSlug',
  'clubName',
  'signupStatus',
];

/**
 * Keeps the session in sync with the database, so changes made by the
 * master admin (reject, demote, deactivate club) apply right away.
 */
async function refreshSessionUser(req, res, next) {
  if (!req.session?.userId || req.session.superAdmin) return next();
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.club_id, u.signup_status,
              c.slug AS club_slug, c.name AS club_name, c.is_active AS club_active
       FROM users u
       JOIN clubs c ON c.id = u.club_id
       WHERE u.id = $1`,
      [req.session.userId]
    );
    const u = rows[0];
    if (!u || !u.club_active) {
      // Account gone or club switched off: sign them out, keep the session itself
      for (const key of IDENTITY_KEYS) delete req.session[key];
      return next();
    }
    req.session.userName = u.name;
    req.session.userEmail = u.email;
    req.session.role = u.role;
    applySessionClub(req, u, { slug: u.club_slug, name: u.club_name });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { refreshSessionUser };
