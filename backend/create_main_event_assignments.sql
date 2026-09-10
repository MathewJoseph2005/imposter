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
