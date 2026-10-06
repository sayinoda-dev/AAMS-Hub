const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { trimMax } = require('../lib/sanitize');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.title, n.body, n.published_at, u.name AS author_name
       FROM news n
       JOIN users u ON u.id = n.author_id
       ORDER BY n.published_at DESC`
    );
    res.json({ news: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load news.' });
  }
});

router.get('/public', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, body, published_at FROM news ORDER BY published_at DESC LIMIT 6`
    );
    res.json({ news: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load news.' });
  }
});

router.post('/', requireRole('admin'), csrfProtection, async (req, res) => {
  const title = trimMax(req.body.title, 200);
  const body = trimMax(req.body.body, 10000);
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required.' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO news (title, body, author_id) VALUES ($1, $2, $3)
       RETURNING id, title, body, published_at`,
      [title, body, req.session.userId]
    );
    res.status(201).json({ news: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not publish news.' });
  }
});

module.exports = router;
