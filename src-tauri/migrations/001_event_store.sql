-- Core event ledger with guaranteed ordering
CREATE TABLE events (
  event_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  stream_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  metadata TEXT,
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stream_id, sequence)
);

CREATE INDEX idx_events_stream ON events(stream_id, sequence);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);

-- Snapshots for performance (every 50-100 events)
CREATE TABLE snapshots (
  stream_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL,
  state_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Save game metadata for UI
CREATE TABLE save_games (
  save_name TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  last_event_id TEXT NOT NULL,
  preview_data TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
