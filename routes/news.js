const express = require('express');
const { pool, query } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { trimMax } = require('../lib/sanitize');
const { saveNewsImages, deleteNewsImageFiles } = require('../lib/newsImages');

const router = express.Router();

async function attachImages(newsRows) {
  if (!newsRows.length) return newsRows;
  const ids = newsRows.map((n) => n.id);
  const { rows: imgs } = await query(
    `SELECT news_id, file_path, mime_type, sort_order
     FROM news_images WHERE news_id = ANY($1::int[])
     ORDER BY sort_order ASC`,
    [ids]
  );
  const byNews = new Map();
  for (const img of imgs) {
    if (!byNews.has(img.news_id)) byNews.set(img.news_id, []);
    byNews.get(img.news_id).push({
      url: img.file_path,
      mime_type: img.mime_type,
    });
  }
  return newsRows.map((n) => ({
    ...n,
    images: byNews.get(n.id) || [],
  }));
}

router.get('/', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.title, n.body, n.published_at, u.name AS author_name
       FROM news n
       JOIN users u ON u.id = n.author_id
       ORDER BY n.published_at DESC`
    );
    const news = await attachImages(rows);
    res.json({ news });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load news.' });
  }
});

router.get('/manage', requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.title, n.body, n.published_at, u.name AS author_name
       FROM news n
       JOIN users u ON u.id = n.author_id
       ORDER BY n.published_at DESC`
    );
    const news = await attachImages(rows);
    res.json({ news });
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
    const news = await attachImages(rows);
    res.json({ news });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load news.' });
  }
});

router.post('/', requireRole('admin'), csrfProtection, async (req, res) => {
  const title = trimMax(req.body.title, 200);
  const body = trimMax(req.body.body, 10000);
  const images = req.body.images;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO news (title, body, author_id) VALUES ($1, $2, $3)
       RETURNING id, title, body, published_at`,
      [title, body, req.session.userId]
    );
    const item = rows[0];
    const savedImages = await saveNewsImages(item.id, images, client);
    await client.query('COMMIT');
    res.status(201).json({
      news: { ...item, images: savedImages.map((url) => ({ url })) },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not publish news.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireRole('admin'), csrfProtection, async (req, res) => {
  const newsId = parseInt(req.params.id, 10);
  if (!newsId) return res.status(400).json({ error: 'Invalid news item.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: imgs } = await client.query(
      `SELECT file_path FROM news_images WHERE news_id = $1`,
      [newsId]
    );
    const { rows } = await client.query(`DELETE FROM news WHERE id = $1 RETURNING id`, [newsId]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'News item not found.' });
    }
    await client.query('COMMIT');
    deleteNewsImageFiles(imgs.map((r) => r.file_path));
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not delete news.' });
  } finally {
    client.release();
  }
});

module.exports = router;
