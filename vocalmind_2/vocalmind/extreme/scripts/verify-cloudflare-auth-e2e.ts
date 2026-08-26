import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

type D1Result<T> = Array<{ results: T[]; success: boolean }>

type WranglerConfig = {
  vars: {
    BETTER_AUTH_URL: string
    MIGRATION_MODE: string
  }
  d1_databases: Array<{
    binding: string
    database_name: string
  }>
}

type LearnerDashboard = {
  ok: boolean
  learner: {
    profile: { id: string; email: string } | null
    progress: Array<{ id: string; stage_id: number; best_score: number; passed: boolean }>
    evaluations: Array<{ id: string; stage_id: number }>
    summary: { totalStages: number; completedStages: number; totalAttempts: number }
  }
}

const root = fileURLToPath(new URL('../', import.meta.url))
const wranglerCli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const config = JSON.parse(
  await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'),
) as WranglerConfig
const configuredDatabase = config.d1_databases.find(
  ({ binding }) => binding === 'DB',
)?.database_name
const baseUrl = new URL(config.vars.BETTER_AUTH_URL).origin

if (process.argv[2] !== '--confirm-remote') {
  throw new Error('Remote synthetic writes require --confirm-remote')
}
if (!configuredDatabase) throw new Error('DB binding is missing from wrangler.jsonc')
if (!baseUrl.endsWith('.workers.dev')) throw new Error('BETTER_AUTH_URL must target Workers')
const database = configuredDatabase

function oauthOnlyEnvironment(): NodeJS.ProcessEnv {
  const blocked = new Set([
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_API_KEY',
    'CF_API_TOKEN',
    'CF_API_KEY',
  ])
  const environment = { ...process.env }
  for (const name of blocked) delete environment[name]
  return environment
}

async function runWrangler(arguments_: string[]): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)('node', [wranglerCli, ...arguments_], {
      cwd: root,
      env: oauthOnlyEnvironment(),
      maxBuffer: 4 * 1024 * 1024,
    })
    return stdout.trim()
  } catch (error) {
    const processError = error as Error & { stderr?: string; stdout?: string }
    throw new Error(
      `Remote D1 command failed: ${processError.stderr?.trim() || processError.stdout?.trim() || processError.message}`,
    )
  }
}

async function d1<T>(sql: string): Promise<T[]> {
  const output = await runWrangler([
    'd1',
    'execute',
    database,
    '--remote',
    '--command',
    sql,
    '--json',
  ])
  const parsed = JSON.parse(output) as D1Result<T>
  if (!parsed.every(({ success }) => success)) {
    throw new Error('Remote D1 command was not successful')
  }
  return parsed.flatMap(({ results }) => results)
}

async function d1File(sql: string): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'vocalmind-d1-'))
  const file = path.join(directory, 'statement.sql')
  try {
    await writeFile(file, `${sql.trim()}\n`, 'utf8')
    await runWrangler(['d1', 'execute', database, '--remote', '--file', file, '--yes'])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function sessionCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
  const cookie = values
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ')
  if (!cookie) throw new Error('Authentication response did not return a session cookie')
  return cookie
}

async function signUp(email: string, password: string, name: string) {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({ email, password, name }),
  })
  if (!response.ok) throw new Error(`Remote sign-up returned ${response.status}`)
  const cookie = sessionCookie(response)
  await response.body?.cancel()
  return cookie
}

async function writeProgress(
  cookie: string,
  input: { stageId: number; score: number; passed: boolean },
) {
  const response = await fetch(`${baseUrl}/api/me/progress`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Remote progress write returned ${response.status}`)
  return (await response.json()) as {
    ok: boolean
    progress: { stage_id: number; best_score: number; passed: boolean } | null
  }
}

async function dashboard(cookie: string): Promise<LearnerDashboard> {
  const response = await fetch(`${baseUrl}/api/me/dashboard?limit=20`, {
    headers: { cookie, origin: baseUrl },
  })
  if (!response.ok) throw new Error(`Remote dashboard returned ${response.status}`)
  return (await response.json()) as LearnerDashboard
}

async function signOut(cookie: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/auth/sign-out`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: baseUrl },
    body: '{}',
  })
  if (!response.ok) throw new Error(`Remote sign-out returned ${response.status}`)
  const clearedCookie = sessionCookie(response)
  await response.body?.cancel()
  const endedSession = await fetch(`${baseUrl}/api/auth/get-session`, {
    headers: { cookie: clearedCookie, origin: baseUrl },
  })
  if (!endedSession.ok || (await endedSession.json()) !== null) {
    throw new Error('Remote sign-out did not clear the session')
  }
}

function requireTrue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const marker = `${Date.now()}-${randomUUID()}`
const accounts = [
  {
    email: `vocalmind-e2e-a-${marker}@example.test`,
    password: `A!${randomUUID()}a9`,
    name: 'Vocalmind E2E A',
  },
  {
    email: `vocalmind-e2e-b-${marker}@example.test`,
    password: `B!${randomUUID()}b9`,
    name: 'Vocalmind E2E B',
  },
]
const before = (
  await d1<{
    source_users: number
    profiles: number
    auth_users: number
    progress: number
    evaluations: number
  }>(
    `SELECT
       (SELECT COUNT(*) FROM supabase_auth_users) AS source_users,
       (SELECT COUNT(*) FROM supabase_public_profiles) AS profiles,
       (SELECT COUNT(*) FROM auth_user) AS auth_users,
       (SELECT COUNT(*) FROM supabase_public_progress) AS progress,
       (SELECT COUNT(*) FROM supabase_public_evaluations) AS evaluations`,
  )
)[0]

let userIds: string[] = []
let result: Record<string, unknown> | undefined
let primaryError: unknown

try {
  const unauthenticated = await fetch(`${baseUrl}/api/me/dashboard`)
  requireTrue(unauthenticated.status === 401, 'Unauthenticated learner data did not return 401')
  await unauthenticated.body?.cancel()

  const cookies = await Promise.all(
    accounts.map(({ email, password, name }) => signUp(email, password, name)),
  )
  const users = await d1<{ id: string; email: string }>(
    `SELECT id, email FROM auth_user WHERE email IN (${accounts
      .map(({ email }) => quote(email))
      .join(', ')}) ORDER BY email`,
  )
  requireTrue(users.length === 2, 'Synthetic users were not persisted')
  userIds = accounts.map(({ email }) => {
    const user = users.find((candidate) => candidate.email === email)
    if (!user) throw new Error('Synthetic user lookup failed')
    return user.id
  })

  const [progressA, progressB] = await Promise.all([
    writeProgress(cookies[0], { stageId: 3, score: 88, passed: true }),
    writeProgress(cookies[1], { stageId: 4, score: 72, passed: false }),
  ])

  const [learnerA, learnerB, readyResponse, migrationResponse] = await Promise.all([
    dashboard(cookies[0]),
    dashboard(cookies[1]),
    fetch(`${baseUrl}/api/ready`),
    fetch(`${baseUrl}/api/migration/status`),
  ])
  const ready = (await readyResponse.json()) as { ok?: boolean; paidCalls?: number }
  const migration = (await migrationResponse.json()) as {
    ok?: boolean
    mode?: string
    parity?: { users?: boolean; passwordCredentials?: boolean; googleIdentities?: boolean }
  }
  const parityCounts = (
    await d1<{
      source_users: number
      source_credentials: number
      source_google_identities: number
      target_users: number
      target_credentials: number
      target_google_identities: number
      missing_users: number
      missing_credentials: number
      missing_google_identities: number
    }>(
      `SELECT
         (SELECT COUNT(*) FROM supabase_auth_users
          WHERE email IS NOT NULL AND trim(email) <> '' AND deleted_at IS NULL) AS source_users,
         (SELECT COUNT(*) FROM supabase_auth_users
          WHERE encrypted_password IS NOT NULL AND trim(encrypted_password) <> ''
            AND deleted_at IS NULL) AS source_credentials,
         (SELECT COUNT(*) FROM supabase_auth_identities WHERE provider = 'google')
            AS source_google_identities,
         (SELECT COUNT(*) FROM auth_user) AS target_users,
         (SELECT COUNT(*) FROM auth_account
          WHERE provider_id = 'credential' AND issuer = 'local:credential') AS target_credentials,
         (SELECT COUNT(*) FROM auth_account WHERE provider_id = 'google')
            AS target_google_identities,
         (SELECT COUNT(*) FROM supabase_auth_users AS source
          LEFT JOIN auth_user AS target ON target.id = source.id
          WHERE source.email IS NOT NULL AND trim(source.email) <> ''
            AND source.deleted_at IS NULL AND target.id IS NULL) AS missing_users,
         (SELECT COUNT(*) FROM supabase_auth_users AS source
          LEFT JOIN auth_account AS target
            ON target.user_id = source.id
           AND target.provider_id = 'credential'
           AND target.issuer = 'local:credential'
          WHERE source.encrypted_password IS NOT NULL
            AND trim(source.encrypted_password) <> ''
            AND source.deleted_at IS NULL AND target.id IS NULL) AS missing_credentials,
         (SELECT COUNT(*) FROM supabase_auth_identities AS source
          LEFT JOIN auth_account AS target
            ON target.user_id = source.user_id
           AND target.provider_id = 'google'
           AND target.account_id = source.provider_id
          WHERE source.provider = 'google' AND target.id IS NULL) AS missing_google_identities`,
    )
  )[0]

  requireTrue(learnerA.ok && learnerB.ok, 'Learner dashboards were not successful')
  requireTrue(learnerA.learner.profile?.email === accounts[0].email, 'Learner A profile mismatch')
  requireTrue(learnerB.learner.profile?.email === accounts[1].email, 'Learner B profile mismatch')
  requireTrue(progressA.progress?.stage_id === 3, 'Learner A progress write mismatch')
  requireTrue(progressA.progress?.best_score === 88, 'Learner A score mismatch')
  requireTrue(progressB.progress?.stage_id === 4, 'Learner B progress write mismatch')
  requireTrue(
    learnerA.learner.progress.some(({ stage_id }) => stage_id === 3),
    'Learner A progress missing',
  )
  requireTrue(
    !learnerA.learner.progress.some(({ stage_id }) => stage_id === 4),
    'Learner A saw learner B progress',
  )
  requireTrue(
    learnerB.learner.progress.some(({ stage_id }) => stage_id === 4),
    'Learner B progress missing',
  )
  requireTrue(
    !learnerB.learner.progress.some(({ stage_id }) => stage_id === 3),
    'Learner B saw learner A progress',
  )
  requireTrue(learnerA.learner.summary.totalStages === 28, 'Curriculum stage count mismatch')
  requireTrue(learnerB.learner.summary.totalStages === 28, 'Curriculum stage count mismatch')

  await signOut(cookies[0])
  requireTrue(readyResponse.ok && ready.ok === true, 'Remote readiness failed')
  requireTrue(ready.paidCalls === 0, 'Readiness used a paid provider call')
  requireTrue(migrationResponse.ok && migration.ok === true, 'Remote migration status failed')
  requireTrue(
    migration.parity?.users === true && parityCounts?.missing_users === 0,
    'Source user parity failed',
  )
  requireTrue(
    migration.parity?.passwordCredentials === true && parityCounts?.missing_credentials === 0,
    'Source password credential parity failed',
  )
  requireTrue(
    migration.parity?.googleIdentities === true && parityCounts?.missing_google_identities === 0,
    'Source Google identity parity failed',
  )

  result = {
    ok: true,
    baseUrl,
    mode: config.vars.MIGRATION_MODE,
    syntheticAccounts: 2,
    signUpSessions: 2,
    progressWrites: 2,
    learnerDashboards: 2,
    curriculumStages: 28,
    signOutSessionCleared: true,
    unauthenticatedLearnerDataStatus: 401,
    crossTenantIsolation: true,
    ready: true,
    paidCalls: ready.paidCalls,
    sourceParity: {
      users: parityCounts?.source_users,
      passwordCredentials: parityCounts?.source_credentials,
      googleIdentities: parityCounts?.source_google_identities,
      targetUsersAtProbe: parityCounts?.target_users,
      targetPasswordCredentialsAtProbe: parityCounts?.target_credentials,
      targetGoogleIdentitiesAtProbe: parityCounts?.target_google_identities,
      missingUsers: parityCounts?.missing_users,
      missingPasswordCredentials: parityCounts?.missing_credentials,
      missingGoogleIdentities: parityCounts?.missing_google_identities,
    },
  }
} catch (error) {
  primaryError = error
} finally {
  if (userIds.length === 0) {
    userIds = (
      await d1<{ id: string }>(
        `SELECT id FROM auth_user WHERE email IN (${accounts
          .map(({ email }) => quote(email))
          .join(', ')})`,
      )
    ).map(({ id }) => id)
  }
  if (userIds.length > 0) {
    const ids = userIds.map(quote).join(', ')
    await d1File(`
      DELETE FROM supabase_public_evaluations WHERE user_id IN (${ids});
      DELETE FROM supabase_public_progress WHERE user_id IN (${ids});
      DELETE FROM supabase_public_profiles WHERE id IN (${ids});
      DELETE FROM auth_session WHERE user_id IN (${ids});
      DELETE FROM auth_account WHERE user_id IN (${ids});
      DELETE FROM auth_user WHERE id IN (${ids});
    `)
  }
}

const after = (
  await d1<{
    source_users: number
    profiles: number
    auth_users: number
    progress: number
    evaluations: number
    residue: number
  }>(
    `SELECT
       (SELECT COUNT(*) FROM supabase_auth_users) AS source_users,
       (SELECT COUNT(*) FROM supabase_public_profiles) AS profiles,
       (SELECT COUNT(*) FROM auth_user) AS auth_users,
       (SELECT COUNT(*) FROM supabase_public_progress) AS progress,
       (SELECT COUNT(*) FROM supabase_public_evaluations) AS evaluations,
       (SELECT COUNT(*) FROM auth_user WHERE email IN (${accounts
         .map(({ email }) => quote(email))
         .join(', ')})) AS residue`,
  )
)[0]
const cleanupVerified =
  before?.source_users === after?.source_users &&
  before?.profiles === after?.profiles &&
  before?.auth_users === after?.auth_users &&
  before?.progress === after?.progress &&
  before?.evaluations === after?.evaluations &&
  after?.residue === 0

if (primaryError) throw primaryError
requireTrue(cleanupVerified, 'Synthetic E2E cleanup did not restore baseline counts')

console.log(
  JSON.stringify({
    ...result,
    cleanupVerified,
    baselineRestored: {
      sourceUsers: after?.source_users,
      profiles: after?.profiles,
      authUsers: after?.auth_users,
      progress: after?.progress,
      evaluations: after?.evaluations,
      residue: after?.residue,
    },
  }),
)
