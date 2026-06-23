-- v9: candidate data persistence — baseline once, methodology profile, session archives
-- Safe additive migration (no drops)

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS baseline_completed_at TIMESTAMPTZ;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS methodology_profile JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goal_progress_pct INT;

ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS full_transcript TEXT;

-- At most one completed baseline per candidate
CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_baseline_per_candidate
  ON assessments (candidate_id)
  WHERE type = 'baseline' AND status = 'completed';
