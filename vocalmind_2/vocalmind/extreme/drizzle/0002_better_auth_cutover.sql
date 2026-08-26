-- Better Auth 1.7 schema plus reversible imports from the preserved snapshot.

CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_uidx ON auth_user (email);

CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_session_token_uidx ON auth_session (token);
CREATE INDEX IF NOT EXISTS auth_session_user_id_idx ON auth_session (user_id);

CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_account_issuer_account_uidx
  ON auth_account (issuer, account_id);
CREATE INDEX IF NOT EXISTS auth_account_user_id_idx ON auth_account (user_id);

CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx
  ON auth_verification (identifier);

INSERT OR IGNORE INTO auth_user
  (id, name, email, email_verified, image, created_at, updated_at)
SELECT
  source.id,
  COALESCE(NULLIF(trim(profile.name), ''),
           NULLIF(substr(source.email, 1, instr(source.email, '@') - 1), ''),
           '보컬마인드 학습자'),
  lower(trim(source.email)),
  CASE WHEN source.email_confirmed_at IS NOT NULL OR source.confirmed_at IS NOT NULL THEN 1 ELSE 0 END,
  NULL,
  CAST(COALESCE(strftime('%s', source.created_at), unixepoch()) AS INTEGER) * 1000,
  CAST(COALESCE(strftime('%s', source.updated_at), unixepoch()) AS INTEGER) * 1000
FROM supabase_auth_users AS source
LEFT JOIN supabase_public_profiles AS profile ON profile.id = source.id
WHERE source.email IS NOT NULL AND trim(source.email) <> '' AND source.deleted_at IS NULL;

INSERT OR IGNORE INTO auth_account
  (id, issuer, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT
  'credential:' || source.id,
  'local:credential',
  source.id,
  'credential',
  source.id,
  source.encrypted_password,
  CAST(COALESCE(strftime('%s', source.created_at), unixepoch()) AS INTEGER) * 1000,
  CAST(COALESCE(strftime('%s', source.updated_at), unixepoch()) AS INTEGER) * 1000
FROM supabase_auth_users AS source
INNER JOIN auth_user AS target ON target.id = source.id
WHERE source.encrypted_password IS NOT NULL
  AND trim(source.encrypted_password) <> ''
  AND source.deleted_at IS NULL;

INSERT OR IGNORE INTO auth_account
  (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
SELECT
  'google:' || source.id,
  'google',
  source.provider_id,
  'google',
  source.user_id,
  CAST(COALESCE(strftime('%s', source.created_at), unixepoch()) AS INTEGER) * 1000,
  CAST(COALESCE(strftime('%s', source.updated_at), unixepoch()) AS INTEGER) * 1000
FROM supabase_auth_identities AS source
INNER JOIN auth_user AS target ON target.id = source.user_id
WHERE source.provider = 'google';

INSERT INTO app_meta (key, value, updated_at)
VALUES ('auth_cutover_status', 'imported', unixepoch())
ON CONFLICT(key) DO UPDATE
SET value = excluded.value, updated_at = excluded.updated_at;
