require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function flushNews() {
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'news');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM news_images');
    await client.query('DELETE FROM news');
    await client.query('COMMIT');
    console.log('All news entries removed from the database.');
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
    console.log('News upload files cleared.');
  }

  await pool.end();
}

flushNews().catch((err) => {
  console.error(err);
  process.exit(1);
});
