-- ============================================================
-- ASTHRA IMPOSTER — Full Database Migration
-- Run this entire file in the Supabase SQL Editor.
-- Tables: main_event_tasks, main_event_assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS main_event_tasks (
    id               SERIAL PRIMARY KEY,
    task_number      INTEGER      NOT NULL UNIQUE,
    task_title       TEXT         NOT NULL,
    task_description TEXT         NOT NULL,

    -- Person 1
    person1_title    TEXT         NOT NULL,
    person1_work     TEXT         NOT NULL,

    -- Person 2
    person2_title    TEXT         NOT NULL,
    person2_work     TEXT         NOT NULL,

    -- Person 3
    person3_title    TEXT         NOT NULL,
    person3_work     TEXT         NOT NULL,

    -- Person 4 (always the Imposter)
    person4_title    TEXT         NOT NULL,
    person4_work     TEXT         NOT NULL,   -- cover job (visible)
    person4_secret   TEXT         NOT NULL,   -- secret sabotage task

    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASK 1 — The 45-Minute Game Plan (Photo Gallery)
-- ============================================================
INSERT INTO main_event_tasks (
    task_number, task_title, task_description,
    person1_title, person1_work,
    person2_title, person2_work,
    person3_title, person3_work,
    person4_title, person4_work, person4_secret
) VALUES (
    1,
    'The 45-Minute Game Plan',
    'Build an interactive photo gallery web app as a team. Each member handles a distinct layer of the UI and functionality. One member is secretly the Imposter with a hidden sabotage objective.',

    'The Frame Maker',
    'Time to code: 20 mins | Testing: 10 mins. Cover Job: Create 4 to 6 picture cards with white borders and simple text captions under them. Goal: Make the main gallery wall look clean and ready to display photos.',

    'The Vibe Switcher',
    'Time to code: 20 mins | Testing: 10 mins. Cover Job: Add 3 simple buttons at the top ("B&W", "Vintage", "Reset"). Goal: Add a quick CSS rule so clicking the buttons changes the photo colors.',

    'The Party Popper',
    'Time to code: 25 mins | Testing: 10 mins. Cover Job: Build a basic click-to-zoom effect. Goal: Make it so clicking a photo opens it bigger on the screen with a dark overlay backdrop.',

    'The Imposter',
    'Time to code: 25 mins | Testing: 10 mins. Cover Job (The Coverup): Build the "Like Button & Reaction Counter" on every photo card so the team thinks you are just making an interactive favorite feature.',
    'The Secret Task (The Trap): Hide the chaos code inside one specific photo''s Like button! If someone clicks that specific photo''s heart 3 times fast, it activates "Chaos Mode" — swaps all photos to silly memes or spins the page.'
);

-- ============================================================
-- TASK 2 — Food Cart Builder
-- ============================================================
INSERT INTO main_event_tasks (
    task_number, task_title, task_description,
    person1_title, person1_work,
    person2_title, person2_work,
    person3_title, person3_work,
    person4_title, person4_work, person4_secret
) VALUES (
    2,
    'Food Cart Builder',
    'Build a food ordering web app as a team. Each member owns a specific feature layer. One member is secretly the Imposter with a hidden inflation sabotage objective.',

    'The UI & Grid Designer',
    'Goal: Build a visual grid of food cards. Key Features: Render dynamic cards containing item images/emojis, dish titles, descriptions, and price tags. Include an "Add to Cart" button on each card. Technical Focus: Component layout (CSS Grid/Flexbox), rendering lists from a JSON dataset.',

    'The Logic Lead',
    'Goal: Create a navigation toolbar that controls what shows up on the screen. Key Features: Filter buttons for "All", "Snacks", "Drinks", and "Desserts", plus a search bar for specific items. Technical Focus: Array filtering methods (.filter()), passing active category states down to the menu grid.',

    'The State Manager',
    'Goal: Build a slide-out drawer that tracks selections and handles financial math. Key Features: A side panel displaying selected items, quantity increments/decrements (+/-), subtotal calculation, tax calculation, and a final total. Technical Focus: State aggregation, JavaScript .reduce() for sum totals, and basic drawer open/close animations.',

    'The Imposter',
    'Cover Job: Build a quick tip selection bar ($1, $2, $5, or Custom %).',
    'Secret Trap ("Inflation Crisis"): Attach a hidden setInterval listener to the $5 Tip button. When clicked, it initiates a loop that increases the final bill by $100 every 50 milliseconds until it hits $999,999. Optional visual touch: Flashes the screen red and adds a warning text: "INFLATION RUNAWAY DETECTED." Technical Focus: Event listeners, asynchronous JavaScript timers (setInterval/clearInterval).'
);

-- ============================================================
-- TASK 3 — Event Fortune Teller / Wheel of Destiny
-- ============================================================
INSERT INTO main_event_tasks (
    task_number, task_title, task_description,
    person1_title, person1_work,
    person2_title, person2_work,
    person3_title, person3_work,
    person4_title, person4_work, person4_secret
) VALUES (
    3,
    'Event Fortune Teller / Wheel of Destiny',
    'Build a mysterious interactive carnival booth where attendees get custom event predictions. One member is secretly the Imposter with a hidden Y2K meltdown sabotage objective.',

    'The Mystic Crystal',
    'Build the main central crystal ball or spinning wheel element with glowing CSS borders and mystical background vibes.',

    'The Fortune Generator',
    'Create 5 selector buttons ("Will I win a prize?", "Who is my event match?", "My future today") that display random fortune cards.',

    'The Audio Oracle',
    'Add eerie/fun sound effect buttons (Gong, Magic Chime, Suspense Drum) that play during fortune readings.',

    'The Imposter',
    'Cover Job: Build a "Enter Your Birth Year" drop-down box to "customize" predictions.',
    'Secret Trap: Selecting the year "1999" triggers Y2K Meltdown — glitchy text rapidly overrides the entire screen, turning the font to neon green matrix code and flashing fake error alerts.'
);

-- ============================================================
-- main_event_assignments
-- One record per participant. Created fresh on each shuffle.
-- ============================================================

CREATE TABLE IF NOT EXISTS main_event_assignments (
    id                SERIAL PRIMARY KEY,

    participant_id UUID NOT NULL UNIQUE
    REFERENCES participants(id)
    ON DELETE CASCADE,

    participant_name  TEXT         NOT NULL,
    original_team     TEXT         NOT NULL,
    shuffled_group    TEXT         NOT NULL,

    task_number       INTEGER      NOT NULL,
    task_title        TEXT         NOT NULL,
    task_description  TEXT         NOT NULL,

    person_slot       INTEGER      NOT NULL,          -- 1 / 2 / 3 (specialist) | 4 (imposter)
    role_name         TEXT         NOT NULL,          -- e.g. "The Frame Maker", "The Imposter"
    work_description  TEXT         NOT NULL,          -- visible work for this slot
    is_imposter       BOOLEAN      NOT NULL DEFAULT FALSE,

    -- submission
    github_repo       TEXT,
    submission_status TEXT         NOT NULL DEFAULT 'Pending',
    submitted_at      TIMESTAMPTZ,
    ai_score          NUMERIC,

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast single-participant lookups
CREATE INDEX IF NOT EXISTS idx_main_event_assignments_participant_id
    ON main_event_assignments (participant_id);
