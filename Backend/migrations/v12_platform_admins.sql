-- v12: Platform super-admin identity

CREATE TABLE IF NOT EXISTS platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'super_admin',
  first_name    TEXT,
  last_name     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
