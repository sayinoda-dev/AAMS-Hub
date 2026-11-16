const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { requireAuth, requireApprovedMember } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { trimMax } = require('../lib/sanitize');
const { logActivity } = require('../lib/activity');

const router = express.Router();

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `chat:${req.session.userId}`,
  message: { error: 'You are sending messages too fast. Wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// A project is reachable if it is in the user's club AND they are a member
// of it, or they are an admin of that club.
async function getAccessibleProject(req, projectId) {
  const { rows } = await query(
    `SELECT p.id, p.club_id
     FROM projects p
     WHERE p.id = $1
       AND p.club_id = $2
       AND ($3::text = 'admin' OR EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id = p.id AND pm.user_id = $4
       ))`,
    [projectId, req.session.clubId, req.session.role, req.session.userId]
  );
  return rows[0] || null;
}

// Latest 50 messages, oldest first
router.get('/projects/:id/messages', requireAuth, requireApprovedMember, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Invalid project.' });
  try {
    const project = await getAccessibleProject(req, projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const { rows } = await query(
      `SELECT * FROM (
         SELECT m.id, m.body, m.created_at, m.user_id,
                COALESCE(u.name, 'Former member') AS author_name,
                u.role AS author_role
         FROM project_messages m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.project_id = $1
         ORDER BY m.id DESC
         LIMIT 50
       ) latest
       ORDER BY id ASC`,
      [projectId]
    );
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        author_name: m.author_name,
        author_role: m.author_role,
        mine: m.user_id === req.session.userId,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load messages.' });
  }
});

router.post(
  '/projects/:id/messages',
  requireAuth,
  requireApprovedMember,
  csrfProtection,
  sendLimiter,
  async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const body = trimMax(req.body.body, 1000);
    if (!projectId) return res.status(400).json({ error: 'Invalid project.' });
    if (!body) return res.status(400).json({ error: 'Write a message first.' });
    try {
      const project = await getAccessibleProject(req, projectId);
      if (!project) return res.status(404).json({ error: 'Project not found.' });

      await query(
        `INSERT INTO project_messages (project_id, club_id, user_id, body)
         VALUES ($1, $2, $3, $4)`,
        [projectId, project.club_id, req.session.userId, body]
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not send message.' });
    }
  }
);

// Authors can delete their own messages; club admins can delete any in their club
router.delete('/messages/:id', requireAuth, requireApprovedMember, csrfProtection, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid message.' });
  try {
    const isAdmin = req.session.role === 'admin';
    const { rowCount } = await query(
      `DELETE FROM project_messages
       WHERE id = $1 AND club_id = $2 AND ($3::boolean OR user_id = $4)`,
      [id, req.session.clubId, isAdmin, req.session.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Message not found.' });
    if (isAdmin) {
      await logActivity('chat_message_deleted', req.session.userId, { messageId: id }, req.session.clubId);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete message.' });
  }
});

module.exports = router;
