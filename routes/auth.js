const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db/pool');
const { trimMax, isValidEmail } = require('../lib/sanitize');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id: req.session.userId,
      name: req.session.userName,
      email: req.session.userEmail,
      role: req.session.role,
    },
  });
});

router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

router.post('/login', csrfProtection, async (req, res) => {
  const email = trimMax(req.body.email, 255).toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role === 'admin' ? 'admin' : 'student';

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  try {
    const { rows } = await query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const user = rows[0];
    if (user.role !== role) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.role = user.role;

    const redirect =
      user.role === 'admin' ? '/admin/dashboard.html' : '/student/news.html';
    res.json({ ok: true, redirect });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

router.post('/logout', csrfProtection, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not sign out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true, redirect: '/login.html' });
  });
});

module.exports = router;
