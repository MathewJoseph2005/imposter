-- ============================================================
-- Migration: create main_event_assignments
-- Run this in the Supabase SQL Editor.
-- Drop and recreate if the table already exists with old columns.
-- ============================================================

DROP TABLE IF EXISTS main_event_assignments;

CREATE TABLE main_event_assignments (
    id                SERIAL PRIMARY KEY,

    participant_id    INTEGER      NOT NULL UNIQUE
                                   REFERENCES participants(id)
                                   ON DELETE CASCADE,

    participant_name  TEXT         NOT NULL,
    original_team     TEXT         NOT NULL,
    shuffled_group    TEXT         NOT NULL,

    task_number       INTEGER      NOT NULL,
    task_title        TEXT         NOT NULL,
    task_description  TEXT         NOT NULL,

    -- slot within the shuffled group
    person_slot       INTEGER      NOT NULL,   -- 1/2/3 = specialist, 4 = imposter
    role_name         TEXT         NOT NULL,   -- e.g. "The Frame Maker", "The Imposter"
    work_description  TEXT         NOT NULL,   -- the participant's visible work instructions
    is_imposter       BOOLEAN      NOT NULL DEFAULT FALSE,

    -- submission
    github_repo       TEXT,
    submission_status TEXT         NOT NULL DEFAULT 'Pending',   -- 'Pending' | 'Submitted'
    submitted_at      TIMESTAMPTZ,
    ai_score          NUMERIC,

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup by participant_id (used by GET /api/my-assignment/:id)
CREATE INDEX IF NOT EXISTS idx_mea_participant_id
    ON main_event_assignments (participant_id);

-- ── Phase 1 migration: add ai_feedback column ──────────────────────────────
-- Safe to run multiple times (IF NOT EXISTS)
ALTER TABLE main_event_assignments
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

-- ── Phase 2 migration: add individual score breakdown columns ─────────────
ALTER TABLE main_event_assignments
  ADD COLUMN IF NOT EXISTS ui_score           INTEGER,
  ADD COLUMN IF NOT EXISTS task_match_score   INTEGER,
  ADD COLUMN IF NOT EXISTS logic_score        INTEGER,
  ADD COLUMN IF NOT EXISTS creativity_score   INTEGER,
  ADD COLUMN IF NOT EXISTS code_quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS evaluation_status  TEXT DEFAULT 'Pending';

-- Run this in Supabase SQL Editor before using Phase 2 evaluation.

-- ── Phase 2 migration: GitHub metadata columns ─────────────────────────────
ALTER TABLE main_event_assignments
  ADD COLUMN IF NOT EXISTS github_owner     TEXT,
  ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
  ADD COLUMN IF NOT EXISTS github_branch    TEXT;

-- ── Phase 3 migration: individual scores + submission lock ─────────────────
ALTER TABLE main_event_assignments
  ADD COLUMN IF NOT EXISTS main_event_score  INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fizzbuzz_score    INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submission_locked BOOLEAN  DEFAULT FALSE;

-- ── manual_event_scores table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_event_scores (
    id             SERIAL PRIMARY KEY,
    event_name     TEXT         NOT NULL,
    original_team  TEXT         NOT NULL,
    marks          INTEGER      NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(event_name, original_team)
);
