-- Rithmos schema, version 3: the narrator (CLAUDE.md 8.1, Stufe 3).
-- One narration per puzzle and prompt version, phrased by the language model
-- from facts the generator shipped with the puzzle. Cached here so the cost
-- is per day, not per player.
CREATE TABLE narrations (
    puzzle_date date NOT NULL REFERENCES puzzles(date) ON DELETE CASCADE,
    version     smallint NOT NULL,
    model       text NOT NULL,
    payload     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (puzzle_date, version)
);
