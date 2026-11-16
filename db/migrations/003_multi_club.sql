-- Multi-club platform: clubs table + club_id isolation

CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  tagline VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO clubs (slug, name, tagline)
VALUES
  ('aams-science', 'AAMS Science Club', 'Observe. Question. Build together.'),
  ('aas-space-science', 'AAS Space Science Club', 'Reach beyond the atmosphere.')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (signup_status IN ('pending', 'approved', 'rejected'));

UPDATE users u
SET club_id = c.id
FROM clubs c
WHERE c.slug = 'aams-science' AND u.club_id IS NULL;

ALTER TABLE users ALTER COLUMN club_id SET NOT NULL;

CREATE OR REPLACE FUNCTION lock_user_club_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'club_id is immutable for this account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_club_immutable ON users;
CREATE TRIGGER users_club_immutable
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION lock_user_club_id();

ALTER TABLE news ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
UPDATE news n
SET club_id = u.club_id
FROM users u
WHERE n.author_id = u.id AND n.club_id IS NULL;

ALTER TABLE news ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
UPDATE ideas i
SET club_id = u.club_id
FROM users u
WHERE i.submitted_by = u.id AND i.club_id IS NULL;

ALTER TABLE ideas ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
UPDATE projects p
SET club_id = i.club_id
FROM ideas i
WHERE p.idea_id = i.id AND p.club_id IS NULL;

ALTER TABLE projects ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);

CREATE INDEX IF NOT EXISTS idx_users_club_id ON users(club_id);
CREATE INDEX IF NOT EXISTS idx_users_signup_status ON users(signup_status);
CREATE INDEX IF NOT EXISTS idx_news_club_id ON news(club_id);
CREATE INDEX IF NOT EXISTS idx_ideas_club_id ON ideas(club_id);
CREATE INDEX IF NOT EXISTS idx_projects_club_id ON projects(club_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_club_id ON activity_log(club_id);
