import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import bcrypt from 'bcryptjs'

type D1Result<T> = Array<{ results: T[]; success: boolean }>
type SourceAccount = { id: string; email: string; encrypted_password: string }
type WranglerConfig = {
  vars: { BETTER_AUTH_URL: string }
  d1_databases: Array<{ binding: string; database_name: string }>
}

const root = fileURLToPath(new URL('../', import.meta.url))
const legacyRoot = path.resolve(root, '..')
const wranglerCli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const config = JSON.parse(
  await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'),
) as WranglerConfig
const configuredDatabase = config.d1_databases.find(
  ({ binding }) => binding === 'DB',
)?.database_name
const baseUrl = new URL(config.vars.BETTER_AUTH_URL).origin

if (process.argv[2] !== '--confirm-remote') {
  throw new Error('Remote legacy sign-in verification requires --confirm-remote')
}
if (!configuredDatabase) throw new Error('DB binding is missing from wrangler.jsonc')
const database = configuredDatabase

const excludedDirectories = new Set([
  '.git',
  '.next',
  '.wrangler',
  'dist',
  'extreme',
  'node_modules',
])
const textExtensions = new Set([
  '.env',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

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
  const { stdout } = await promisify(execFile)('node', [wranglerCli, ...arguments_], {
    cwd: root,
    env: oauthOnlyEnvironment(),
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout.trim()
}

async function sourceAccounts(): Promise<SourceAccount[]> {
  const output = await runWrangler([
    'd1',
    'execute',
    database,
    '--remote',
    '--command',
    `SELECT id, email, encrypted_password FROM supabase_auth_users
     WHERE encrypted_password IS NOT NULL AND trim(encrypted_password) <> ''
       AND deleted_at IS NULL`,
    '--json',
  ])
  const parsed = JSON.parse(output) as D1Result<SourceAccount>
  if (!parsed.every(({ success }) => success)) throw new Error('Remote password audit query failed')
  return parsed.flatMap(({ results }) => results)
}

async function collectFiles(directory: string, output: string[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        await collectFiles(path.join(directory, entry.name), output)
      }
      continue
    }
    if (!entry.isFile()) continue
    const file = path.join(directory, entry.name)
    const extension = path.extname(entry.name).toLowerCase()
    if (!entry.name.startsWith('.env') && !textExtensions.has(extension)) continue
    const metadata = await stat(file)
    if (metadata.size > 2 * 1024 * 1024) continue
    output.push(file)
  }
}

function addCandidate(candidates: Set<string>, rawValue: string) {
  const value = rawValue.trim().replace(/^['"]|['"]$/g, '')
  if (value.length < 8 || value.length > 128) return
  if (Buffer.byteLength(value, 'utf8') > 72) return
  if (/\$\{|process\.env|changeme|your[_-]?password|<.+>|\*{3,}/i.test(value)) return
  candidates.add(value)
}

async function documentedCandidates() {
  const files: string[] = []
  await collectFiles(legacyRoot, files)
  const candidates = new Set<string>()
  const assignment =
    /(?:password|passwd|passphrase|demo_pass|test_pass|user_pass)[\w-]*\s*[:=]\s*['"]([^'"\r\n]{8,128})['"]/gi
  const environment =
    /^[A-Z0-9_]*(?:PASSWORD|PASSWD|PASSPHRASE)[A-Z0-9_]*\s*=\s*([^\s#\r\n]{8,128})/gim

  for (const file of files) {
    const contents = await readFile(file, 'utf8').catch(() => '')
    for (const regex of [assignment, environment]) {
      regex.lastIndex = 0
      for (let match = regex.exec(contents); match; match = regex.exec(contents)) {
        if (match[1]) addCandidate(candidates, match[1])
      }
    }
  }
  return { candidates: [...candidates], scannedFiles: files.length }
}

function responseCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
  const cookie = values
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ')
  if (!cookie) throw new Error('Legacy sign-in did not return a session cookie')
  return cookie
}

async function remoteSignIn(account: SourceAccount, password: string) {
  const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({ email: account.email, password }),
  })
  if (!signIn.ok) return false
  const cookie = responseCookie(signIn)
  await signIn.body?.cancel()

  const dashboard = await fetch(`${baseUrl}/api/me/dashboard?limit=1`, {
    headers: { cookie, origin: baseUrl },
  })
  const dashboardOk = dashboard.ok
  await dashboard.body?.cancel()

  const signOut = await fetch(`${baseUrl}/api/auth/sign-out`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: baseUrl },
    body: '{}',
  })
  await signOut.body?.cancel()
  return dashboardOk && signOut.ok
}

const accounts = await sourceAccounts()
const { candidates, scannedFiles } = await documentedCandidates()
const matches: Array<{ account: SourceAccount; password: string }> = []

for (const account of accounts) {
  for (const candidate of candidates) {
    if (await bcrypt.compare(candidate, account.encrypted_password)) {
      matches.push({ account, password: candidate })
      break
    }
  }
}

let remoteSignIns = 0
for (const match of matches) {
  if (await remoteSignIn(match.account, match.password)) remoteSignIns += 1
}

console.log(
  JSON.stringify({
    ok: true,
    scannedFiles,
    candidateLiterals: candidates.length,
    sourcePasswordAccounts: accounts.length,
    matchedAccounts: matches.length,
    remoteSignIns,
    unmatchedAccounts: accounts.length - matches.length,
    complete: remoteSignIns === accounts.length,
    secretValuesExposed: false,
  }),
)
