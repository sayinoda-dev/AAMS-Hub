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

module.exports = router;
