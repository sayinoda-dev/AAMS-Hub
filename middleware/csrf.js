const csrf = require('csurf');

const csrfProtection = csrf({ cookie: false });

function sendCsrfToken(req, res) {
  res.json({ csrfToken: req.csrfToken() });
}

module.exports = { csrfProtection, sendCsrfToken };
