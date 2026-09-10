-- ============================================================
-- TEST DATA SEED — Development / Testing Only
-- Run this in the Supabase SQL Editor ONLY in dev environments.
-- Safe to run multiple times — skips teams that already exist.
-- DO NOT run this in production.
-- ============================================================

DO $$
DECLARE
    v_team_count  INTEGER;
    v_team4_id    INTEGER;
    v_team5_id    INTEGER;
    v_team6_id    INTEGER;
BEGIN
    -- Only seed if fewer than 6 teams currently exist
    SELECT COUNT(*) INTO v_team_count FROM teams;

    IF v_team_count >= 6 THEN
        RAISE NOTICE 'Seed skipped: % teams already exist (need fewer than 6 to seed).', v_team_count;
        RETURN;
    END IF;

    -- ── Team 4: Phoenix ───────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM teams WHERE team_name = 'Phoenix') THEN
        INSERT INTO teams (team_name, team_code)
        VALUES ('Phoenix', 'PHO0004')
        RETURNING id INTO v_team4_id;

        INSERT INTO participants (team_id, participant_name) VALUES
            (v_team4_id, 'Ethan P'),
            (v_team4_id, 'Fiona P'),
            (v_team4_id, 'George P'),
            (v_team4_id, 'Hannah P');

        RAISE NOTICE 'Inserted Team 4: Phoenix (id=%).', v_team4_id;
    ELSE
        RAISE NOTICE 'Team "Phoenix" already exists — skipped.';
    END IF;

    -- ── Team 5: Titans ────────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM teams WHERE team_name = 'Titans') THEN
        INSERT INTO teams (team_name, team_code)
        VALUES ('Titans', 'TIT0005')
        RETURNING id INTO v_team5_id;

        INSERT INTO participants (team_id, participant_name) VALUES
            (v_team5_id, 'Ivan T'),
            (v_team5_id, 'Julia T'),
            (v_team5_id, 'Kevin T'),
            (v_team5_id, 'Laura T');

        RAISE NOTICE 'Inserted Team 5: Titans (id=%).', v_team5_id;
    ELSE
        RAISE NOTICE 'Team "Titans" already exists — skipped.';
    END IF;

    -- ── Team 6: Quantum ───────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM teams WHERE team_name = 'Quantum') THEN
        INSERT INTO teams (team_name, team_code)
        VALUES ('Quantum', 'QUA0006')
        RETURNING id INTO v_team6_id;

        INSERT INTO participants (team_id, participant_name) VALUES
            (v_team6_id, 'Mike Q'),
            (v_team6_id, 'Nina Q'),
            (v_team6_id, 'Oscar Q'),
            (v_team6_id, 'Priya Q');

        RAISE NOTICE 'Inserted Team 6: Quantum (id=%).', v_team6_id;
    ELSE
        RAISE NOTICE 'Team "Quantum" already exists — skipped.';
    END IF;

END $$;
