-- One row per person. `id` is what the site knows them by: accounts copied from Firebase keep
-- their Firebase id, so what a browser already holds still matches; new ones get a random id.
-- `google_sub` is Google's id for their account, and is never sent to anyone else.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT,
  -- Everything saved to the account except finished tests, as JSON. Null until the first save.
  data TEXT,
  updated_at TEXT
);

-- Finished tests, one row each: each keeps all its answers, and a long history in one row
-- would outgrow D1's 2 MB limit.
CREATE TABLE IF NOT EXISTS tests (
  user_id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (user_id, completed_at)
) WITHOUT ROWID;

-- The public leaderboard: a nickname, an avatar and two counts per person, never an email.
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- So the top 100 is read straight off the index instead of every entry.
CREATE INDEX IF NOT EXISTS leaderboard_rank ON leaderboard (answered DESC, correct DESC);

-- Doodles, one row each: a drawing can run to tens of kB, so they'd soon outgrow the account's
-- row. `strokes` is null for one deleted, so the deletion reaches the person's other devices.
CREATE TABLE IF NOT EXISTS doodles (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  strokes TEXT,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
) WITHOUT ROWID;
