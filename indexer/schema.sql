-- VestFlow Event Indexer — SQLite schema
-- Idempotent: safe to re-run on an existing database.

CREATE TABLE IF NOT EXISTS schedule_events (
  -- Stellar-assigned event ID: "<ledger>-<txIndex>-<eventIndex>"
  id TEXT PRIMARY KEY,

  event_type TEXT NOT NULL CHECK (event_type IN ('schedule_created', 'claimed', 'revoked', 'unknown')),

  ledger            INTEGER NOT NULL,
  ledger_closed_at  TEXT    NOT NULL, -- ISO 8601 (from Stellar RPC)

  schedule_id INTEGER,    -- parsed from topic[1]
  grantor     TEXT,       -- parsed from topic[2] for schedule_created / revoked
  beneficiary TEXT,       -- parsed from topic[2] for claimed; topic[3] for created
  amount      TEXT,       -- bigint as decimal string (claimed events only)

  raw_topics TEXT NOT NULL, -- JSON array of native-decoded topic values
  raw_value  TEXT NOT NULL, -- JSON of native-decoded event value

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_grantor      ON schedule_events (grantor);
CREATE INDEX IF NOT EXISTS idx_beneficiary  ON schedule_events (beneficiary);
CREATE INDEX IF NOT EXISTS idx_schedule_id  ON schedule_events (schedule_id);
CREATE INDEX IF NOT EXISTS idx_event_type   ON schedule_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ledger       ON schedule_events (ledger);

-- Singleton checkpoint row — stores the highest fully-processed ledger.
CREATE TABLE IF NOT EXISTS checkpoint (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  last_ledger INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO checkpoint (id, last_ledger) VALUES (1, 0);