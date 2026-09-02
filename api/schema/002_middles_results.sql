-- Rithmos schema, version 2: the Middles form of the coverage metric.
-- One row per finished puzzle (daily or practice), keyed by the client id so
-- uploads are idempotent across devices. cents is the deviation of a tuned
-- answer from the mean, null when the answer was tapped.
CREATE TABLE middles_results (
    id         text NOT NULL,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device     text NOT NULL DEFAULT '',
    t          timestamptz NOT NULL,
    mode       text NOT NULL CHECK (mode IN ('daily', 'practice')),
    level      smallint NOT NULL CHECK (level BETWEEN 0 AND 9),
    kind       text NOT NULL CHECK (kind IN ('arithmetic', 'geometric', 'musical')),
    solved     boolean NOT NULL,
    tries      smallint NOT NULL CHECK (tries >= 1),
    cents      real,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id)
);
CREATE INDEX middles_results_account_t ON middles_results (account_id, t);
