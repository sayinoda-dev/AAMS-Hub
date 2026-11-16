require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { generateGroupCode, codeExpiresAt } = require('./groupCode');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CLUB_SLUG = process.env.SEED_CLUB_SLUG || 'aams-science';

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.error(
      'Refusing to seed in production: it creates accounts with known passwords. ' +
        'Set ALLOW_SEED=true only if you really mean it.'
    );
    process.exit(1);
  }

  const client = await pool.connect();
  const expiryDays = parseInt(process.env.GROUP_CODE_EXPIRY_DAYS || '7', 10);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@club.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminChangeMe1!';
  const adminName = process.env.SEED_ADMIN_NAME || 'Club Admin';

  try {
    await client.query('BEGIN');

    const { rows: clubRows } = await client.query(
      'SELECT id, name FROM clubs WHERE slug = $1',
      [CLUB_SLUG]
    );
    if (!clubRows.length) {
      throw new Error(`Club "${CLUB_SLUG}" not found. Run npm run db:migrate first.`);
    }
    const clubId = clubRows[0].id;
    console.log('Seeding club:', clubRows[0].name);

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
        `INSERT INTO users (name, email, password_hash, role, club_id, signup_status)
         VALUES ($1, $2, $3, 'admin', $4, 'approved') RETURNING id`,
        [adminName, adminEmail, hash, clubId]
      );
      adminId = ins.rows[0].id;
      console.log('Created admin:', adminEmail);
    }

    // Students must use @gmail.com to sign in, so the demo accounts do too.
    // These are placeholder addresses: keep SMTP unset in dev so no email is sent.
    const students = [
      { name: 'Maya Chen', email: 'seed.maya.chen@gmail.com', password: 'Student123!' },
      { name: 'Jordan Lee', email: 'seed.jordan.lee@gmail.com', password: 'Student123!' },
      { name: 'Sam Rivera', email: 'seed.sam.rivera@gmail.com', password: 'Student123!' },
    ];

    const studentIds = [];
    for (const s of students) {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [s.email]);
      if (rows.length) {
        studentIds.push(rows[0].id);
      } else {
        const hash = await bcrypt.hash(s.password, 12);
        const ins = await client.query(
          `INSERT INTO users (name, email, password_hash, role, club_id, signup_status)
           VALUES ($1, $2, $3, 'student', $4, 'approved') RETURNING id`,
          [s.name, s.email, hash, clubId]
        );
        studentIds.push(ins.rows[0].id);
      }
    }

    const { rows: newsCount } = await client.query(
      'SELECT COUNT(*)::int AS c FROM news WHERE club_id = $1',
      [clubId]
    );
    if (newsCount[0].c === 0) {
      await client.query(
        `INSERT INTO news (title, body, author_id, club_id, published_at) VALUES
         ($1, $2, $3, $4, NOW() - INTERVAL '2 days'),
         ($5, $6, $3, $4, NOW() - INTERVAL '1 day'),
         ($7, $8, $3, $4, NOW())`,
        [
          'Lab hours extended for spring',
          'The workshop will stay open until 6pm on Thursdays through May. Bring your logbooks if you are continuing an ongoing experiment.',
          adminId,
          clubId,
          'Guest lecture: local watershed study',
          'Dr. Okonkwo visits next Tuesday at 4pm in Room 12. All members welcome; note-taking encouraged.',
          'Safety briefing reminder',
          'Before any field work, complete the updated safety checklist on the bulletin board. Goggles and gloves are required in the chemical bay.',
        ]
      );
      console.log('Seeded news items.');
    }

    const { rows: ideaCount } = await client.query(
      'SELECT COUNT(*)::int AS c FROM ideas WHERE club_id = $1',
      [clubId]
    );
    if (ideaCount[0].c === 0) {
      await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status, club_id) VALUES
         ($1, $2, $3, 'pending', $7),
         ($4, $5, $6, 'pending', $7)`,
        [
          'Soil pH mapping on the north field',
          'Weekly samples along a grid, chart changes after rainfall. Need shared kit for test strips.',
          studentIds[0],
          'Low-power weather station',
          'Arduino-based station logging temp and humidity to a shared spreadsheet for comparison with official data.',
          studentIds[1],
          clubId,
        ]
      );

      const acceptedIdea = await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status, reviewed_at, club_id)
         VALUES ($1, $2, $3, 'accepted', NOW(), $4) RETURNING id`,
        [
          'Compost heat experiment',
          'Track internal temperature of school compost bins versus ambient air over six weeks.',
          studentIds[2],
          clubId,
        ]
      );

      let code = generateGroupCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await client.query('SAVEPOINT project_insert');
          await client.query(
            `INSERT INTO projects (idea_id, title, description, group_code, code_expires_at, club_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              acceptedIdea.rows[0].id,
              'Compost heat experiment',
              'Track internal temperature of school compost bins versus ambient air over six weeks.',
              code,
              codeExpiresAt(expiryDays),
              clubId,
            ]
          );
          console.log('Seeded project with group code:', code);
          break;
        } catch (e) {
          if (e.code === '23505') {
            await client.query('ROLLBACK TO SAVEPOINT project_insert');
            code = generateGroupCode();
          } else {
            throw e;
          }
        }
      }

      await client.query(
        `INSERT INTO ideas (title, description, submitted_by, status, reviewed_at, club_id)
         VALUES ($1, $2, $3, 'rejected', NOW(), $4)`,
        [
          'Rocket fuel synthesis',
          'Not appropriate for school facilities without specialist supervision.',
          studentIds[0],
          clubId,
        ]
      );

      console.log('Seeded ideas (pending, accepted, rejected).');
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log('Admin login:   ' + adminEmail + ' / ' + adminPassword);
    console.log('Student logins: seed.maya.chen@gmail.com / Student123! (also jordan, sam)');
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
