-- v10: Organization portal — org admins, RBAC identity
-- Safe additive migration

CREATE TABLE IF NOT EXISTS org_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'org_admin',
  first_name    TEXT,
  last_name     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON org_members (org_id);
CREATE INDEX IF NOT EXISTS org_members_candidate_id_idx ON org_members (candidate_id);

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS org_id UUID;
