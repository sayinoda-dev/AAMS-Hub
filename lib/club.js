// lib/club.js
const { query } = require('../db/pool');

async function getClubById(id) {
  const clubId = parseInt(id, 10);
  if (!clubId) return null;
  const { rows } = await query(
    `SELECT id, slug, name, is_active, requires_approval
     FROM clubs
     WHERE id = $1`,
    [clubId]
  );
  return rows[0] || null;
}

async function getActiveClubs() {
  const { rows } = await query(
    `SELECT id, slug, name
     FROM clubs
     WHERE is_active = true
     ORDER BY name`
  );
  return rows;
}

function applySessionClub(req, user, club) {
  req.session.clubId = user.club_id;
  req.session.clubSlug = club.slug;
  req.session.clubName = club.name;
  req.session.signupStatus = user.signup_status;
}

function clearSessionClub(req) {
  delete req.session.clubId;
  delete req.session.clubSlug;
  delete req.session.clubName;
  delete req.session.signupStatus;
}

module.exports = {
  getClubById,
  getActiveClubs,
  applySessionClub,
  clearSessionClub,
};
