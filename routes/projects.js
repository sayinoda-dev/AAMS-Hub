
const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireRole, requireApprovedMember } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { trimMax } = require('../lib/sanitize');

const router = express.Router();

router.get('/', requireAuth, requireApprovedMember, async (req, res) => {
  try {
    const userId = req.session.userId;
    const clubId = req.session.clubId;
    const { rows } = await query(
      `SELECT p.id, p.title, p.description, p.group_code, p.code_expires_at, p.created_at,
              EXISTS (
                SELECT 1 FROM project_members pm
                WHERE pm.project_id = p.id AND pm.user_id = $1
              ) AS joined
       FROM projects p
       WHERE p.club_id = $2
       ORDER BY p.created_at DESC`,
      [userId, clubId]
    );
    res.json({
      projects: rows.map((p) => ({
        ...p,
        group_code: undefined,
        code_expired: new Date(p.code_expires_at) < new Date(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

router.get('/public', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.title, p.description, p.created_at, c.name AS club_name, c.slug AS club_slug
       FROM projects p
       JOIN clubs c ON c.id = p.club_id
       WHERE c.is_active = true
       ORDER BY p.created_at DESC
       LIMIT 8`
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

router.post('/join', requireRole('student'), requireApprovedMember, csrfProtection, async (req, res) => {
  const code = trimMax(String(req.body.group_code || '').toUpperCase().replace(/\s/g, ''), 12);
  if (!code || code.length < 6) {
    return res.status(400).json({ error: 'Enter the group code from your project lead.' });
  }
  try {
    const { rows } = await query(
      `SELECT id, title, code_expires_at, club_id FROM projects WHERE group_code = $1`,
      [code]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'No project matches that code.' });
    }
    const project = rows[0];
        if (project.club_id !== req.session.clubId) {
      return res.status(404).json({ error: 'No project matches that code.' });
    }
    if (new Date(project.code_expires_at) < new Date()) {
      return res.status(410).json({
        error: 'This group code has expired. Ask an admin to issue a new code.',
      });
    }
    await query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [project.id, req.session.userId]
    );
    res.json({ ok: true, project: { id: project.id, title: project.title } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not join the project.' });
  }
});

router.get('/my-memberships', requireRole('student'), requireApprovedMember, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.title, pm.joined_at
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = $1 AND p.club_id = $2
       ORDER BY pm.joined_at DESC`,
      [req.session.userId, req.session.clubId]
    );
    res.json({ memberships: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your groups.' });
  }
});
// One-click join: any approved student can join a project in their own club
router.post('/:id/join', requireRole('student'), requireApprovedMember, csrfProtection, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Invalid project.' });
  try {
    const { rows } = await query(
      'SELECT id, title FROM projects WHERE id = $1 AND club_id = $2',
      [projectId, req.session.clubId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found.' });
    await query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectId, req.session.userId]
    );
    res.json({ ok: true, project: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not join the project.' });
  }
});

// Leave a project (also removes access to its chat)
router.delete('/:id/membership', requireRole('student'), requireApprovedMember, csrfProtection, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Invalid project.' });
  try {
    await query(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2
         AND project_id IN (SELECT id FROM projects WHERE club_id = $3)`,
      [projectId, req.session.userId, req.session.clubId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not leave the project.' });
  }
});
module.exports = router;
