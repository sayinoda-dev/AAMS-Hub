const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

async function sendProjectCodeEmail({ to, studentName, projectTitle, groupCode, expiresAt }) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const subject = `Science Club project code: ${projectTitle}`;
  const text = `Hello ${studentName || 'there'},

Your project idea "${projectTitle}" has been accepted.

Your unique project group code is: ${groupCode}

Use this code on the Projects page to join your group. ${
    expiryText ? `This code expires on ${expiryText}.` : ''
  }

— AAMS Science Club`;

  if (!transport) {
    console.warn('[mail] SMTP not configured; project code email skipped for', to);
    return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({ from, to, subject, text });
  return { ok: true };
}

module.exports = { sendProjectCodeEmail };
