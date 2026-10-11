require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { pool } = require('./db/pool');
const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const ideasRoutes = require('./routes/ideas');
const projectsRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');
const superRoutes = require('./routes/super');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionMiddleware = session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
  },
});

app.use(sessionMiddleware);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many sign-in attempts. Wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many registration attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/master-login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super', superRoutes);

function protectHtml(role, file) {
  return (req, res, next) => {
    if (role === 'superadmin') {
      if (!req.session?.superAdmin) {
        return res.redirect('/master-login.html');
      }
      return res.sendFile(path.join(__dirname, 'public', file));
    }
    if (!req.session?.userId) {
      return res.redirect('/login.html?next=' + encodeURIComponent(req.path));
    }
    if (req.session.role !== role) {
      return res.redirect(role === 'admin' ? '/student/news.html' : '/admin/dashboard.html');
    }
    res.sendFile(path.join(__dirname, 'public', file));
  };
}

app.get('/student/news.html', protectHtml('student', 'student/news.html'));
app.get('/student/submit-idea.html', protectHtml('student', 'student/submit-idea.html'));
app.get('/student/projects.html', protectHtml('student', 'student/projects.html'));
app.get('/admin/dashboard.html', protectHtml('admin', 'admin/dashboard.html'));
app.get('/admin/publish-news.html', protectHtml('admin', 'admin/publish-news.html'));
app.get('/admin/review-queue.html', protectHtml('admin', 'admin/review-queue.html'));
app.get('/super/dashboard.html', protectHtml('superadmin', 'super/dashboard.html'));
app.get('/master-login.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'master-login.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, _next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Session expired. Refresh the page and try again.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Upload too large. Use fewer or smaller images.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Science club app listening on http://localhost:${PORT}`);
});
