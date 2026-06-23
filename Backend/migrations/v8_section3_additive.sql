-- v8 Section 3: additive schema (safe — no drops, no column removals)
-- Source: AI_Avatar_New_Requirements_for_Cursor.md Section 3

-- 3.1 Enrich the Goals table (org-assignable goals)
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS title           TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS theme           TEXT,          -- e.g. 'Executive Presence', 'Influence'
  ADD COLUMN IF NOT EXISTS is_org_assigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assigned_by     UUID,          -- employer/admin id, null if self-set
  ADD COLUMN IF NOT EXISTS org_id          UUID;

-- 3.2 Assessments (baseline / midpoint / final)
CREATE TABLE IF NOT EXISTS assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  goal_id         UUID REFERENCES goals(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,            -- 'baseline' | 'midpoint' | 'final'
  status          TEXT DEFAULT 'in_progress', -- 'in_progress' | 'completed'
  difficulty_tier INT  DEFAULT 1,           -- 1..3 adaptive tier reached
  score           INT,                      -- 0-100 overall
  strategic_score INT,
  operational_score INT,
  influence_score INT,
  level           TEXT,                     -- readable band, e.g. 'Developing'
  strengths       TEXT[],
  gaps            TEXT[],
  questions       JSONB DEFAULT '[]',       -- generated question objects
  answers         JSONB DEFAULT '[]',       -- candidate answers
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessments_own ON assessments
  USING (candidate_id IN (SELECT id FROM candidates WHERE auth.uid()::text = id::text));

-- 3.3 Action plans + action items
CREATE TABLE IF NOT EXISTS action_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  goal_id       UUID REFERENCES goals(id) ON DELETE SET NULL,
  focus_areas   TEXT[],                     -- top development themes
  summary       TEXT,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_plans_own ON action_plans
  USING (candidate_id IN (SELECT id FROM candidates WHERE auth.uid()::text = id::text));

CREATE TABLE IF NOT EXISTS action_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id  UUID REFERENCES action_plans(id) ON DELETE CASCADE,
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  kind            TEXT DEFAULT 'milestone',  -- 'milestone' | 'exercise' | 'next_step'
  title           TEXT NOT NULL,
  detail          TEXT,
  due_date        DATE,
  is_completed    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_items_own ON action_items
  USING (candidate_id IN (SELECT id FROM candidates WHERE auth.uid()::text = id::text));

-- 3.4 Organizations, membership, seats (the org-sponsored model)
CREATE TABLE IF NOT EXISTS organizations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  contact_email  TEXT,
  domain         TEXT,
  plan           TEXT DEFAULT 'team',
  seats_allocated INT DEFAULT 5,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  team_name     TEXT,
  risk_level    TEXT DEFAULT 'on_track',  -- 'on_track' | 'at_risk' | 'needs_attention'
  pipeline_stage TEXT,                     -- e.g. 'Emerging' | 'Developing' | 'Ready'
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3.5 Reports + audit log
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  org_id        UUID,
  type          TEXT DEFAULT 'candidate',  -- 'candidate' | 'organization'
  payload       JSONB,                     -- full report body (see 6.5)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_role  TEXT,                        -- 'candidate' | 'org_admin' | 'super_admin'
  action      TEXT,
  target      TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
