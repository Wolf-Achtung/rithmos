-- Rithmos schema, version 5: the rules chat (CLAUDE.md 8.4). One row per question,
-- for the per-account and per-day caps and for reusing an answer when the same
-- question comes again. cached marks rows that cost no model call.
CREATE TABLE rule_questions (
    id             bigserial PRIMARY KEY,
    account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    question       text NOT NULL,
    normalized     text NOT NULL,
    answer         text NOT NULL,
    grounded       boolean NOT NULL,
    cached         boolean NOT NULL DEFAULT false,
    model          text NOT NULL,
    prompt_version integer NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rule_questions_account_created ON rule_questions (account_id, created_at);
CREATE INDEX rule_questions_normalized ON rule_questions (normalized, prompt_version);
