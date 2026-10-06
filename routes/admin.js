const express = require('express');
const { query } = require('../db/pool');
const { requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { generateGroupCode, codeExpiresAt } = require('../db/groupCode');

const router = express.Router();

router.get('/stats', requireRole('admin'), async (_req, res) => {
  try {
    const [pending, news, projects] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM ideas WHERE status = 'pending'`),
      query(`SELECT COUNT(*)::int AS c FROM news`),
      query(`SELECT COUNT(*)::int AS c FROM projects`),
    ]);
    res.json({
      pendingIdeas: pending.rows[0].c,
      newsCount: news.rows[0].c,
      projectCount: projects.rows[0].c,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

router.get('/ideas/pending', requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.title, i.description, i.created_at, u.name AS submitter_name, u.email AS submitter_email
       FROM ideas i
       JOIN users u ON u.id = i.submitted_by
       WHERE i.status = 'pending'
       ORDER BY i.created_at ASC`
    );
    res.json({ ideas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the queue.' });
  }
});

async function uniqueGroupCode(client) {
  for (let i = 0; i < 15; i++) {
    const code = generateGroupCode();
    const { rows } = await client.query(
      'SELECT 1 FROM projects WHERE group_code = $1',
      [code]
    );
    if (!rows.length) return code;
  }
  throw new Error('Could not generate unique group code');
}

router.post('/ideas/:id/accept', requireRole('admin'), csrfProtection, async (req, res) => {
  const ideaId = parseInt(req.params.id, 10);
  if (!ideaId) return res.status(400).json({ error: 'Invalid idea.' });

  const expiryDays = parseInt(process.env.GROUP_CODE_EXPIRY_DAYS || '7', 10);
  const client = await require('../db/pool').pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ideas } = await client.query(
      `SELECT id, title, description, status FROM ideas WHERE id = $1 FOR UPDATE`,
      [ideaId]
    );
    if (!ideas.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Idea not found.' });
    }
    const idea = ideas[0];
    if (idea.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This idea was already reviewed.' });
    }

    const groupCode = await uniqueGroupCode(client);
    const expires = codeExpiresAt(expiryDays);

    await client.query(
      `UPDATE ideas SET status = 'accepted', reviewed_at = NOW() WHERE id = $1`,
      [ideaId]
    );

    const { rows: proj } = await client.query(
      `INSERT INTO projects (idea_id, title, description, group_code, code_expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, group_code, code_expires_at`,
      [ideaId, idea.title, idea.description, groupCode, expires]
    );

    await client.query('COMMIT');
    res.json({
      ok: true,
      project: proj[0],
      message: 'Project created. Share the group code with students who should join.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not accept the idea.' });
  } finally {
    client.release();
  }
});

router.post('/ideas/:id/reject', requireRole('admin'), csrfProtection, async (req, res) => {
  const ideaId = parseInt(req.params.id, 10);
  if (!ideaId) return res.status(400).json({ error: 'Invalid idea.' });
  try {
    const { rows } = await query(
      `UPDATE ideas SET status = 'rejected', reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [ideaId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Idea not found or already reviewed.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reject the idea.' });
  }
});

router.get('/projects', requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.title, p.group_code, p.code_expires_at, p.created_at,
              (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count
       FROM projects p
       ORDER BY p.created_at DESC`
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

router.post('/projects/:id/regenerate-code', requireRole('admin'), csrfProtection, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Invalid project.' });
  const expiryDays = parseInt(process.env.GROUP_CODE_EXPIRY_DAYS || '7', 10);
  const client = await require('../db/pool').pool.connect();
  try {
    const groupCode = await uniqueGroupCode(client);
    const expires = codeExpiresAt(expiryDays);
    const { rows } = await client.query(
      `UPDATE projects SET group_code = $1, code_expires_at = $2 WHERE id = $3
       RETURNING id, title, group_code, code_expires_at`,
      [groupCode, expires, projectId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ ok: true, project: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not regenerate code.' });
  } finally {
    client.release();
  }
});

module.exports = router;
