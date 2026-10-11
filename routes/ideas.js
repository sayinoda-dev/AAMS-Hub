const express = require('express');
const { query } = require('../db/pool');
const { requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { trimMax } = require('../lib/sanitize');
const { logActivity } = require('../lib/activity');

const router = express.Router();

router.post('/', requireRole('student'), csrfProtection, async (req, res) => {
  const title = trimMax(req.body.title, 200);
  const description = trimMax(req.body.description, 5000);
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  if (description.length < 20) {
    return res.status(400).json({ error: 'Add a bit more detail (at least 20 characters).' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO ideas (title, description, submitted_by, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, title, description, status, created_at`,
      [title, description, req.session.userId]
    );
    await logActivity('idea_submit', req.session.userId, {
      ideaId: rows[0].id,
      title: rows[0].title,
    });
    res.status(201).json({ idea: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit your idea.' });
  }
});

router.get('/mine', requireRole('student'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, description, status, created_at, reviewed_at
       FROM ideas WHERE submitted_by = $1 ORDER BY created_at DESC`,
      [req.session.userId]
    );
    res.json({ ideas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your ideas.' });
  }
});

module.exports = router;
