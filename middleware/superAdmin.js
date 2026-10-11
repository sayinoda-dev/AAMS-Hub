const crypto = require('crypto');

function requireSuperAdmin(req, res, next) {
  if (!req.session?.superAdmin) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Master access required.' });
    }
    return res.redirect('/login.html');
  }
  next();
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyMasterCredentials(username, password) {
  const expectedUser = process.env.MASTER_USERNAME || '';
  const expectedPass = process.env.MASTER_PASSWORD || '';
  if (!expectedUser || !expectedPass) return false;
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

module.exports = { requireSuperAdmin, verifyMasterCredentials };
