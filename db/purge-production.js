require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/**
 * Removes test/dummy operational data. User accounts are preserved.
 * Run only when preparing for production: npm run db:purge-production
 */
async function purge() {
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'news');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_code_emails');
    await client.query('DELETE FROM project_members');
    await client.query('DELETE FROM projects');
    await client.query('DELETE FROM ideas');
    await client.query('DELETE FROM news_images');
    await client.query('DELETE FROM news');
    await client.query('COMMIT');
    console.log('Purged ideas, projects, groups, and news.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (fs.existsSync(uploadsDir)) {
    for (const name of fs.readdirSync(uploadsDir)) {
      if (name === '.gitkeep') continue;
      fs.unlinkSync(path.join(uploadsDir, name));
    }
  }

  await pool.end();
}

purge().catch((err) => {
  console.error(err);
  process.exit(1);
});
