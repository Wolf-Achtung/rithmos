-- Rithmos schema, version 4: the hunt (Zug F). One row per photo sent to the
-- vision model, for the per-account and per-day caps. No image is stored.
CREATE TABLE hunts (
    id         bigserial PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    groups     smallint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hunts_account_created ON hunts (account_id, created_at);
