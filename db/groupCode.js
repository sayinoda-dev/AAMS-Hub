const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateGroupCode(length = 7) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

function codeExpiresAt(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = { generateGroupCode, codeExpiresAt, CHARSET };
