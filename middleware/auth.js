function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    return res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Sign in required.' });
      }
      return res.redirect('/login.html');
    }
    if (req.session.role !== role) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'You do not have access to this.' });
      }
      if (role === 'admin') {
        return res.redirect('/student/news.html');
      }
      return res.redirect('/admin/dashboard.html');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
