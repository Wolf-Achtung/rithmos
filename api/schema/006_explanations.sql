-- Rithmos schema, version 6: "Erklär es mir" (CLAUDE.md 6 on the daily puzzle).
-- One row per explanation a player gave for a day's answer: the pattern the
-- model read out of the words, and the verdict the server drew from it.
CREATE TABLE explanations (
    id          bigserial PRIMARY KEY,
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    puzzle_date date NOT NULL REFERENCES puzzles(date) ON DELETE CASCADE,
    text        text NOT NULL,
    pattern     text NOT NULL CHECK (pattern IN ('steps', 'factors', 'ratio', 'unclear')),
    verdict     text NOT NULL CHECK (verdict IN ('understood', 'luck', 'slip', 'misread', 'none')),
    model       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX explanations_account_created ON explanations (account_id, created_at);
