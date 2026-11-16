const express = require('express');
const { query } = require('../db/pool');
const { requireRole, assertClubScope } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { generateGroupCode, codeExpiresAt } = require('../db/groupCode');
const { sendProjectCodeEmail } = require('../lib/mail');
const { logActivity } = require('../lib/activity');

const router = express.Router();

router.get('/stats', requireRole('admin'), async (req, res) => {
  const clubId = req.session.clubId;
  try {
    const [pending, news, projects] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM ideas WHERE status = 'pending' AND club_id = $1`, [
        clubId,
      ]),
      query(`SELECT COUNT(*)::int AS c FROM news WHERE club_id = $1`, [clubId]),
      query(`SELECT COUNT(*)::int AS c FROM projects WHERE club_id = $1`, [clubId]),
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

router.get('/ideas/pending', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.title, i.description, i.created_at, u.name AS submitter_name, u.email AS submitter_email
       FROM ideas i
       JOIN users u ON u.id = i.submitted_by
       WHERE i.status = 'pending' AND i.club_id = $1
       ORDER BY i.created_at ASC`,
      [req.session.clubId]
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
      `SELECT i.id, i.title, i.description, i.status, i.submitted_by,
              u.email AS submitter_email, u.name AS submitter_name
       FROM ideas i
       JOIN users u ON u.id = i.submitted_by
       WHERE i.id = $1 AND i.club_id = $2 FOR UPDATE`,
      [ideaId, req.session.clubId]
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
      `INSERT INTO projects (idea_id, title, description, group_code, code_expires_at, club_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, group_code, code_expires_at`,
      [ideaId, idea.title, idea.description, groupCode, expires, req.session.clubId]
    );

    await client.query('COMMIT');

    const project = proj[0];
    let emailStatus = 'skipped';
    try {
      const mailResult = await sendProjectCodeEmail({
        to: idea.submitter_email,
        studentName: idea.submitter_name,
        projectTitle: project.title,
        groupCode: project.group_code,
        expiresAt: project.code_expires_at,
      });
      emailStatus = mailResult.skipped ? 'skipped' : 'sent';
      await query(
        `INSERT INTO project_code_emails (project_id, recipient_email, status)
         VALUES ($1, $2, $3)`,
        [project.id, idea.submitter_email, emailStatus]
      );
    } catch (mailErr) {
      console.error('project code email:', mailErr);
      emailStatus = 'failed';
      try {
        await query(
          `INSERT INTO project_code_emails (project_id, recipient_email, status)
           VALUES ($1, $2, 'failed')`,
          [project.id, idea.submitter_email]
        );
      } catch (_) {
        /* ignore */
      }
    }

    await logActivity(
      'idea_accepted',
      req.session.userId,
      { ideaId, projectId: project.id, emailStatus },
      req.session.clubId
    );

    res.json({
      ok: true,
      project,
      emailStatus,
      message:
        emailStatus === 'sent'
          ? 'Project created. The group code was emailed to the student’s Gmail.'
          : 'Project created. Share the group code with students who should join.',
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
       WHERE id = $1 AND status = 'pending' AND club_id = $2
       RETURNING id`,
      [ideaId, req.session.clubId]
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

router.get('/projects', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.title, p.group_code, p.code_expires_at, p.created_at,
              (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count
       FROM projects p
       WHERE p.club_id = $1
       ORDER BY p.created_at DESC`,
      [req.session.clubId]
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
      `UPDATE projects SET group_code = $1, code_expires_at = $2
       WHERE id = $3 AND club_id = $4
       RETURNING id, title, group_code, code_expires_at`,
      [groupCode, expires, projectId, req.session.clubId]
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
