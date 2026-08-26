export type MigrationCounts = {
  sourceUsers: number
  sourcePasswordCredentials: number
  sourceGoogleIdentities: number
  importedUsers: number
  importedPasswordCredentials: number
  importedGoogleIdentities: number
  missingUsers: number
  missingPasswordCredentials: number
  missingGoogleIdentities: number
  profiles: number
  progress: number
  evaluations: number
}

type CountRow = { count: number }

export async function readMigrationCounts(db: D1Database): Promise<MigrationCounts> {
  const results = await db.batch<CountRow>([
    db.prepare(
      `SELECT COUNT(*) AS count FROM supabase_auth_users
       WHERE email IS NOT NULL AND trim(email) <> '' AND deleted_at IS NULL`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS count FROM supabase_auth_users
       WHERE encrypted_password IS NOT NULL AND trim(encrypted_password) <> ''
         AND deleted_at IS NULL`,
    ),
    db.prepare("SELECT COUNT(*) AS count FROM supabase_auth_identities WHERE provider = 'google'"),
    db.prepare('SELECT COUNT(*) AS count FROM auth_user'),
    db.prepare(
      `SELECT COUNT(*) AS count FROM auth_account
       WHERE provider_id = 'credential' AND issuer = 'local:credential'`,
    ),
    db.prepare("SELECT COUNT(*) AS count FROM auth_account WHERE provider_id = 'google'"),
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM supabase_auth_users AS source
       LEFT JOIN auth_user AS target ON target.id = source.id
       WHERE source.email IS NOT NULL AND trim(source.email) <> ''
         AND source.deleted_at IS NULL AND target.id IS NULL`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM supabase_auth_users AS source
       LEFT JOIN auth_account AS target
         ON target.user_id = source.id
        AND target.provider_id = 'credential'
        AND target.issuer = 'local:credential'
       WHERE source.encrypted_password IS NOT NULL
         AND trim(source.encrypted_password) <> ''
         AND source.deleted_at IS NULL AND target.id IS NULL`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM supabase_auth_identities AS source
       LEFT JOIN auth_account AS target
         ON target.user_id = source.user_id
        AND target.provider_id = 'google'
        AND target.account_id = source.provider_id
       WHERE source.provider = 'google' AND target.id IS NULL`,
    ),
    db.prepare('SELECT COUNT(*) AS count FROM supabase_public_profiles'),
    db.prepare('SELECT COUNT(*) AS count FROM supabase_public_progress'),
    db.prepare('SELECT COUNT(*) AS count FROM supabase_public_evaluations'),
  ])

  const count = (index: number) => results[index]?.results[0]?.count ?? 0
  return {
    sourceUsers: count(0),
    sourcePasswordCredentials: count(1),
    sourceGoogleIdentities: count(2),
    importedUsers: count(3),
    importedPasswordCredentials: count(4),
    importedGoogleIdentities: count(5),
    missingUsers: count(6),
    missingPasswordCredentials: count(7),
    missingGoogleIdentities: count(8),
    profiles: count(9),
    progress: count(10),
    evaluations: count(11),
  }
}

export function migrationParity(counts: MigrationCounts) {
  return {
    users: counts.missingUsers === 0,
    passwordCredentials: counts.missingPasswordCredentials === 0,
    googleIdentities: counts.missingGoogleIdentities === 0,
  }
}
