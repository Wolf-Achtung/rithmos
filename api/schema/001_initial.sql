-- Rithmos schema, version 1. Applied by rithmos_api.migrate in order of file name.

CREATE TABLE accounts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash   text NOT NULL UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz
);

-- One scored marking per turn, synced from every device of an account.
CREATE TABLE coverage_records (
    id         uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device     text NOT NULL DEFAULT '',
    t          timestamptz NOT NULL,
    coverage   real NOT NULL CHECK (coverage >= 0 AND coverage <= 1),
    assist     smallint NOT NULL CHECK (assist BETWEEN 0 AND 3),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coverage_records_account_t ON coverage_records (account_id, t);

-- Daily Middles puzzles, generated and verified by jobs/. payload is what
-- clients see; solution stays server-side until an attempt is recorded.
CREATE TABLE puzzles (
    date       date PRIMARY KEY,
    side       text NOT NULL CHECK (side IN ('white', 'black')),
    difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    payload    jsonb NOT NULL,
    solution   jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- One attempt per account and puzzle.
CREATE TABLE attempts (
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    puzzle_date date NOT NULL REFERENCES puzzles(date) ON DELETE CASCADE,
    tries       smallint NOT NULL CHECK (tries >= 1),
    seconds     integer NOT NULL CHECK (seconds >= 0),
    solved      boolean NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, puzzle_date)
);
