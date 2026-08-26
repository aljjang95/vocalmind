-- Minimal local contract for the preserved Vocalmind Supabase snapshot.
-- Remote tables already exist; every definition is non-destructive.

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS supabase_auth_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  encrypted_password TEXT,
  email_confirmed_at TEXT,
  confirmed_at TEXT,
  raw_user_meta_data TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS supabase_auth_identities (
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  identity_data TEXT NOT NULL DEFAULT '{}',
  provider TEXT NOT NULL,
  last_sign_in_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  email TEXT,
  id TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS supabase_public_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'free',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  api_usage_won INTEGER DEFAULT 0,
  api_usage_reset_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  onboarding_result TEXT
);

CREATE TABLE IF NOT EXISTS supabase_public_progress (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  stage_id INTEGER NOT NULL,
  best_score INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS supabase_public_progress_user_id_stage_id_key
  ON supabase_public_progress (user_id, stage_id);

CREATE TABLE IF NOT EXISTS supabase_public_evaluations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  stage_id INTEGER NOT NULL,
  score INTEGER,
  pitch_accuracy INTEGER,
  tone_stability REAL,
  tension_detected INTEGER DEFAULT 0,
  tension_detail TEXT DEFAULT '',
  feedback TEXT DEFAULT '',
  passed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS supabase_public_evaluations_user_created_idx
  ON supabase_public_evaluations (user_id, created_at DESC);

INSERT INTO app_meta (key, value, updated_at)
VALUES ('supabase_source_contract', 'verified', unixepoch())
ON CONFLICT(key) DO UPDATE
SET value = excluded.value, updated_at = excluded.updated_at;
