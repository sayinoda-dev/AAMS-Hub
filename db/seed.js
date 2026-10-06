require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { generateGroupCode, codeExpiresAt } = require('./groupCode');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  const expiryDays = parseInt(process.env.GROUP_CODE_EXPIRY_DAYS || '7', 10);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@club.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminChangeMe1!';
  const adminName = process.env.SEED_ADMIN_NAME || 'Club Admin';

  try {
    await client.query('BEGIN');

    const { rows: existingAdmin } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    let adminId;
    if (existingAdmin.length) {
      adminId = existingAdmin[0].id;
      console.log('Admin already exists:', adminEmail);
    } else {
      const hash = await bcrypt.hash(adminPassword, 12);
      const ins = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
        [adminName, adminEmail, hash]
      );
      adminId = ins.rows[0].id;
      console.log('Created admin:', adminEmail);
    }

    const students = [
      { name: 'Maya Chen', email: 'maya@student.local', password: 'Student123!' },
      { name: 'Jordan Lee', email: 'jordan@student.local', password: 'Student123!' },
      { name: 'Sam Rivera', email: 'sam@student.local', password: 'Student123!' },
    ];

    const studentIds = [];
    for (const s of students) {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [s.email]);
      if (rows.length) {
        studentIds.push(rows[0].id);
      } else {
        const hash = await bcrypt.hash(s.password, 12);
        const ins = await client.query(
          `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id`,
          [s.name, s.email, hash]
        );
        studentIds.push(ins.rows[0].id);
      }
    }

    const { rows: newsCount } = await client.query('SELECT COUNT(*)::int AS c FROM news');
    if (newsCount[0].c === 0) {
      await client.query(
        `INSERT INTO news (title, body, author_id, published_at) VALUES
         ($1, $2, $3, NOW() - INTERVAL '2 days'),
         ($4, $5, $3, NOW() - INTERVAL '1 day'),
         ($6, $7, $3, NOW())`,
        [
          'Lab hours extended for spring',
          'The workshop will stay open until 6pm on Thursdays through May. Bring your logbooks if you are continuing an ongoing experiment.',
          adminId,
          'Guest lecture: local watershed study',
          'Dr. Okonkwo visits next Tuesday at 4pm in Room 12. All members welcome; note-taking encouraged.',
          'Safety briefing reminder',
          'Before any field work, complete the updated safety checklist on the bulletin board. Goggles and gloves are required in the chemical bay.',
        ]
      );
      console.log('Seeded news items.');
    }

    const { rows: ideaCount } = await client.query('SELECT COUNT(*)::int AS c FROM ideas');
    if (ideaCount[0].c === 0) {
      await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status) VALUES
         ($1, $2, $3, 'pending'),
         ($4, $5, $6, 'pending')`,
        [
          'Soil pH mapping on the north field',
          'Weekly samples along a grid, chart changes after rainfall. Need shared kit for test strips.',
          studentIds[0],
          'Low-power weather station',
          'Arduino-based station logging temp and humidity to a shared spreadsheet for comparison with official data.',
          studentIds[1],
        ]
      );

      const acceptedIdea = await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status, reviewed_at) VALUES
         ($1, $2, $3, 'accepted', NOW()) RETURNING id`,
        [
          'Compost heat experiment',
          'Track internal temperature of school compost bins versus ambient air over six weeks.',
          studentIds[2],
        ]
      );

      let code = generateGroupCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await client.query(
            `INSERT INTO projects (idea_id, title, description, group_code, code_expires_at) VALUES ($1, $2, $3, $4, $5)`,
            [
              acceptedIdea.rows[0].id,
              'Compost heat experiment',
              'Track internal temperature of school compost bins versus ambient air over six weeks.',
              code,
              codeExpiresAt(expiryDays),
            ]
          );
          console.log('Seeded project with group code:', code);
          break;
        } catch (e) {
          if (e.code === '23505') code = generateGroupCode();
          else throw e;
        }
      }

      await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status, reviewed_at) VALUES
         ($1, $2, $3, 'rejected', NOW())`,
        [
          'Rocket fuel synthesis',
          'Not appropriate for school facilities without specialist supervision.',
          studentIds[0],
        ]
      );

      console.log('Seeded ideas (pending, accepted, rejected).');
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log('Student logins: maya@student.local / Student123! (and jordan, sam)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
