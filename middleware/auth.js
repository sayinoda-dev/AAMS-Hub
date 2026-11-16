function requireAuth(req, res, next) {
  if (req.session?.superAdmin) {
    return next();
  }
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
    if (req.session?.superAdmin) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Master admins use the oversight API.' });
      }
      return res.redirect('/super/dashboard.html');
    }
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

/** Students must be approved by master admin before club features. */
function requireApprovedMember(req, res, next) {
  if (req.session?.superAdmin) return next();
  if (req.session?.role === 'admin') return next();
  if (req.session?.signupStatus === 'approved') return next();
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({
      error: 'Your membership is awaiting master approval.',
      signupStatus: req.session.signupStatus || 'pending',
    });
  }
  return res.redirect('/register-pending.html');
}

/** Ensures row club_id matches the signed-in user's club (not for super admin). */
function assertClubScope(clubIdFromRow, req) {
  if (req.session?.superAdmin) return true;
  if (!req.session?.clubId) return false;
  return parseInt(clubIdFromRow, 10) === parseInt(req.session.clubId, 10);
}

function requireSameClubParam(paramName = 'clubId') {
  return (req, res, next) => {
    if (req.session?.superAdmin) return next();
    const requested = parseInt(req.params[paramName] || req.body?.club_id, 10);
    if (requested && requested !== req.session.clubId) {
      return res.status(403).json({ error: 'You cannot access another club.' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireApprovedMember,
  assertClubScope,
  requireSameClubParam,
};
