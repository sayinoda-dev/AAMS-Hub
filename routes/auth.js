const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db/pool');
const { trimMax, isValidEmail, isValidGmail } = require('../lib/sanitize');
const { csrfProtection } = require('../middleware/csrf');
const { verifyMasterCredentials } = require('../middleware/superAdmin');
const { logActivity, touchDailyActive } = require('../lib/activity');

const router = express.Router();

router.get('/me', async (req, res) => {
  if (req.session?.superAdmin) {
    return res.json({
      user: {
        id: null,
        name: 'System Creator',
        email: null,
        role: 'superadmin',
      },
    });
  }
  if (!req.session?.userId) {
    return res.json({ user: null });
  }
  await touchDailyActive(req.session.userId);
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

router.post('/register', csrfProtection, async (req, res) => {
  const name = trimMax(req.body.name, 120);
  const email = trimMax(req.body.email, 255).toLowerCase();
  const password = String(req.body.password || '');

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }
  if (!isValidGmail(email)) {
    return res.status(400).json({ error: 'Use a valid @gmail.com address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, name, email, role`,
      [name, email, hash]
    );
    const user = rows[0];
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    req.session.superAdmin = false;

    await logActivity('user_register', user.id, { email: user.email });
    await touchDailyActive(user.id);

    res.status(201).json({ ok: true, redirect: '/student/news.html' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this Gmail already exists. Sign in instead.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not create your account.' });
  }
});

router.post('/login', csrfProtection, async (req, res) => {
  const email = trimMax(req.body.email, 255).toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role === 'admin' ? 'admin' : 'student';

  if (role === 'student') {
    if (!isValidGmail(email) || !password) {
      return res.status(400).json({ error: 'Enter a valid Gmail address and password.' });
    }
  } else if (!isValidEmail(email) || !password) {
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
    req.session.superAdmin = false;

    await logActivity('user_login', user.id, { role: user.role });
    await touchDailyActive(user.id);

    const redirect =
      user.role === 'admin' ? '/admin/dashboard.html' : '/student/news.html';
    res.json({ ok: true, redirect });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

router.post('/master-login', csrfProtection, async (req, res) => {
  const username = trimMax(req.body.username, 120);
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Enter master username and password.' });
  }
  if (!verifyMasterCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid master credentials.' });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not start master session.' });
    }
    req.session.superAdmin = true;
    delete req.session.userId;
    delete req.session.userName;
    delete req.session.userEmail;
    delete req.session.role;
    logActivity('master_login', null, {}).catch(() => {});
    res.json({ ok: true, redirect: '/super/dashboard.html' });
  });
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
