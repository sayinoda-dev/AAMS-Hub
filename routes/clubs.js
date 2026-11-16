const express = require('express');
const { getActiveClubs } = require('../lib/club');

const router = express.Router();

/** Public list for registration dropdown only (active clubs). */
router.get('/', async (_req, res) => {
  try {
    const clubs = await getActiveClubs();
    res.json({ clubs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load clubs.' });
  }
});

module.exports = router;
