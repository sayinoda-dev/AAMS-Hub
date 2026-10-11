-- News images, activity analytics, optional email dispatch log

CREATE TABLE IF NOT EXISTS news_images (
  id SERIAL PRIMARY KEY,
  news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  file_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(64) NOT NULL DEFAULT 'image/webp',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_images_news_id ON news_images(news_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);

CREATE TABLE IF NOT EXISTS project_code_emails (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped'))
);
