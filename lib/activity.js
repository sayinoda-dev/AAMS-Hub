const { query } = require('../db/pool');

async function logActivity(eventType, userId = null, meta = {}) {
  try {
    await query(
      `INSERT INTO activity_log (event_type, user_id, meta) VALUES ($1, $2, $3)`,
      [eventType, userId, JSON.stringify(meta || {})]
    );
  } catch (err) {
    console.error('activity_log:', err.message);
  }
}

async function touchDailyActive(userId) {
  if (!userId) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT id FROM activity_log
       WHERE event_type = 'daily_active' AND user_id = $1
         AND (meta->>'day') = $2
       LIMIT 1`,
      [userId, day]
    );
    if (rows.length) return;
    await logActivity('daily_active', userId, { day });
  } catch (err) {
    console.error('daily_active:', err.message);
  }
}

module.exports = { logActivity, touchDailyActive };
