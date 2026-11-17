const express = require('express');
const { query } = require('../db/pool');
const { requireSuperAdmin } = require('../middleware/superAdmin');
const { csrfProtection } = require('../middleware/csrf');
const { deleteNewsImageFiles } = require('../lib/newsImages');
const { logActivity } = require('../lib/activity');

const router = express.Router();

router.get('/analytics', requireSuperAdmin, async (_req, res) => {
  try {
    const [registrations, dailyActive, projects, ideas, recent] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS c FROM users WHERE role = 'student'
         AND created_at >= NOW() - INTERVAL '30 days'`
      ),
      query(
        `SELECT (meta->>'day') AS day, COUNT(DISTINCT user_id)::int AS users
         FROM activity_log
         WHERE event_type = 'daily_active'
           AND created_at >= NOW() - INTERVAL '14 days'
         GROUP BY day
         ORDER BY day DESC`
      ),
      query(`SELECT COUNT(*)::int AS c FROM projects`),
      query(
        `SELECT status, COUNT(*)::int AS c FROM ideas GROUP BY status ORDER BY status`
      ),
      query(
        `SELECT a.event_type, a.meta, a.created_at, u.name AS user_name, u.email AS user_email
         FROM activity_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT 100`
      ),
    ]);

    res.json({
      registrationsLast30Days: registrations.rows[0].c,
      dailyActive: dailyActive.rows,
      projectCount: projects.rows[0].c,
      ideasByStatus: ideas.rows,
      recentActivity: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load analytics.' });
  }
});

router.post('/purge-production-data', requireSuperAdmin, csrfProtection, async (_req, res) => {
  const client = await require('../db/pool').pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: paths } = await client.query(`SELECT file_path FROM news_images`);
    await client.query('DELETE FROM project_code_emails');
    await client.query('DELETE FROM project_members');
    await client.query('DELETE FROM projects');
    await client.query('DELETE FROM ideas');
    await client.query('DELETE FROM news_images');
    await client.query('DELETE FROM news');
    await client.query('COMMIT');
    deleteNewsImageFiles(paths.map((r) => r.file_path));
    await logActivity('production_purge', null, { via: 'super_dashboard' });
    res.json({ ok: true, message: 'Operational test data removed. User accounts kept.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Purge failed.' });
  } finally {
    client.release();
  }
});

/* ---------- Member approvals ---------- */

// List members by status: /api/super/members?status=pending (default), approved, rejected or all
router.get('/members', requireSuperAdmin, async (req, res) => {
  const status = String(req.query.status || 'pending');
  const allowed = ['pending', 'approved', 'rejected', 'all'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  try {
    const params = [];
    let where = '';
    if (status !== 'all') {
      params.push(status);
      where = 'WHERE u.signup_status = $1';
    }
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.signup_status, u.created_at,
              c.id AS club_id, c.name AS club_name
       FROM users u
       JOIN clubs c ON c.id = u.club_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT 200`,
      params
    );
    res.json({ members: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load members.' });
  }
});

async function setSignupStatus(req, res, status) {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ error: 'Invalid user.' });
  try {
    const { rows } = await query(
      `UPDATE users SET signup_status = $1
       WHERE id = $2 AND role = 'student'
       RETURNING id, email, club_id, signup_status`,
      [status, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    await logActivity(
      `member_${status}`,
      null,
      { userId, email: rows[0].email },
      rows[0].club_id
    );
    res.json({ ok: true, member: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update member.' });
  }
}

router.post('/members/:id/approve', requireSuperAdmin, csrfProtection, (req, res) =>
  setSignupStatus(req, res, 'approved')
);
router.post('/members/:id/reject', requireSuperAdmin, csrfProtection, (req, res) =>
  setSignupStatus(req, res, 'rejected')
);

// Make a registered member a club admin, or demote back to student
router.post('/members/:id/role', requireSuperAdmin, csrfProtection, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const role = String(req.body?.role || '');
  if (!userId || !['admin', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  try {
    const { rows } = await query(
      `UPDATE users SET role = $1, signup_status = 'approved'
       WHERE id = $2
       RETURNING id, email, role, club_id`,
      [role, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    await logActivity('member_role_changed', null, { userId, role }, rows[0].club_id);
    res.json({ ok: true, member: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not change role.' });
  }
});

/* ---------- Club management ---------- */

router.get('/clubs', requireSuperAdmin, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.slug, c.name, c.tagline, c.is_active, c.requires_approval,
              (SELECT COUNT(*)::int FROM users u WHERE u.club_id = c.id) AS member_count
       FROM clubs c
       ORDER BY c.name`
    );
    res.json({ clubs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load clubs.' });
  }
});

router.post('/clubs', requireSuperAdmin, csrfProtection, async (req, res) => {
  const slug = String(req.body?.slug || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const tagline = String(req.body?.tagline || '').trim().slice(0, 255) || null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    return res.status(400).json({ error: 'Slug: lowercase letters, numbers and hyphens only.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Enter a club name.' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO clubs (slug, name, tagline) VALUES ($1, $2, $3)
       RETURNING id, slug, name, tagline, is_active`,
      [slug, name, tagline]
    );
    await logActivity('club_created', null, { slug }, rows[0].id);
    res.status(201).json({ ok: true, club: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That slug is already used.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not create club.' });
  }
});

router.post('/clubs/:id/active', requireSuperAdmin, csrfProtection, async (req, res) => {
  const clubId = parseInt(req.params.id, 10);
  if (!clubId || typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  try {
    const { rows } = await query(
      `UPDATE clubs SET is_active = $1 WHERE id = $2 RETURNING id, slug, is_active`,
      [req.body.active, clubId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Club not found.' });
    await logActivity('club_active_changed', null, { active: req.body.active }, clubId);
    res.json({ ok: true, club: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update club.' });
  }
});

// Turn the "approval required" setting on or off for a club
router.post('/clubs/:id/approval', requireSuperAdmin, csrfProtection, async (req, res) => {
  const clubId = parseInt(req.params.id, 10);
  if (!clubId || typeof req.body?.required !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  try {
    const { rows } = await query(
      `UPDATE clubs SET requires_approval = $1 WHERE id = $2
       RETURNING id, slug, requires_approval`,
      [req.body.required, clubId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Club not found.' });
    await logActivity('club_approval_changed', null, { required: req.body.required }, clubId);
    res.json({ ok: true, club: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update club.' });
  }
});

module.exports = router;
