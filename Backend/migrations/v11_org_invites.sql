-- v11: Org invite-based onboarding + Vapi call tracking

CREATE TABLE IF NOT EXISTS org_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  invite_token  TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending',
  invited_by    UUID,
  candidate_id  UUID REFERENCES candidates(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  UNIQUE (org_id, email)
);

ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT;

CREATE INDEX IF NOT EXISTS org_invites_token_idx ON org_invites (invite_token);
CREATE INDEX IF NOT EXISTS org_invites_email_idx ON org_invites (email);
