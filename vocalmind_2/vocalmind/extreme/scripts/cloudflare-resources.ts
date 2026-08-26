import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Mode = 'check' | 'setup'

interface D1DatabaseRow {
  uuid: string
  name: string
}

interface VectorizeRow {
  name: string
  config: { dimensions: number; metric: string }
}

interface WranglerConfig {
  vars: { PRODUCT_SLUG: string }
  d1_databases: Array<{
    binding: string
    database_name: string
    database_id: string
    migrations_dir: string
  }>
}

const root = fileURLToPath(new URL('../', import.meta.url))
const configPath = path.join(root, 'wrangler.jsonc')
const tokenEnvironmentNames = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_API_KEY',
  'CF_API_TOKEN',
  'CF_API_KEY',
]

function oauthOnlyEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !tokenEnvironmentNames.includes(key)) environment[key] = value
  }
  return environment
}

async function runWrangler(arguments_: string[]): Promise<string> {
  const process_ = Bun.spawn(['bun', 'x', 'wrangler', ...arguments_], {
    cwd: root,
    env: oauthOnlyEnvironment(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process_.stdout).text(),
    new Response(process_.stderr).text(),
    process_.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`wrangler ${arguments_.join(' ')} failed: ${stderr.trim() || stdout.trim()}`)
  }
  return stdout.trim()
}

async function assertOauthSession(): Promise<void> {
  const whoami = await runWrangler(['whoami'])
  if (!/logged in with an OAuth Token/i.test(whoami)) {
    throw new Error(
      'Wrangler OAuth session is required. Run `wrangler login`; API tokens are rejected.',
    )
  }
}

async function d1Databases(): Promise<D1DatabaseRow[]> {
  return JSON.parse(await runWrangler(['d1', 'list', '--json'])) as D1DatabaseRow[]
}

async function r2BucketExists(name: string): Promise<boolean> {
  try {
    await runWrangler(['r2', 'bucket', 'info', name])
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/not found|does not exist|10006/i.test(message)) return false
    throw error
  }
}

async function vectorizeIndexes(): Promise<VectorizeRow[]> {
  return JSON.parse(await runWrangler(['vectorize', 'list', '--json'])) as VectorizeRow[]
}

async function readConfig(): Promise<WranglerConfig> {
  return JSON.parse(await Bun.file(configPath).text()) as WranglerConfig
}

async function writeDatabaseId(config: WranglerConfig, databaseId: string): Promise<void> {
  const database = config.d1_databases.find((item) => item.binding === 'DB')
  if (!database) throw new Error('DB binding is missing from wrangler.jsonc')
  if (database.database_id === databaseId) return
  database.database_id = databaseId
  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`)
}

async function snapshot(slug: string) {
  const mainBucket = `${slug}-assets`
  const previewBucket = `${slug}-assets-preview`
  const [databases, mainBucketExists, previewBucketExists, indexes] = await Promise.all([
    d1Databases(),
    r2BucketExists(mainBucket),
    r2BucketExists(previewBucket),
    vectorizeIndexes(),
  ])
  return {
    database: databases.find((item) => item.name === `${slug}-production`),
    buckets: new Set(
      [mainBucketExists && mainBucket, previewBucketExists && previewBucket].filter(
        (name): name is string => Boolean(name),
      ),
    ),
    index: indexes.find((item) => item.name === `${slug}-index`),
  }
}

async function setupMissing(slug: string): Promise<string[]> {
  const created: string[] = []
  const current = await snapshot(slug)

  if (!current.database) {
    await runWrangler(['d1', 'create', `${slug}-production`, '--location', 'apac'])
    created.push(`D1:${slug}-production`)
  }
  for (const bucket of [`${slug}-assets`, `${slug}-assets-preview`]) {
    if (!current.buckets.has(bucket)) {
      await runWrangler(['r2', 'bucket', 'create', bucket, '--location', 'apac'])
      created.push(`R2:${bucket}`)
    }
  }
  if (!current.index) {
    await runWrangler([
      'vectorize',
      'create',
      `${slug}-index`,
      '--dimensions',
      '768',
      '--metric',
      'cosine',
    ])
    created.push(`Vectorize:${slug}-index`)
  }
  return created
}

async function main(): Promise<void> {
  const mode = process.argv[2] as Mode | undefined
  if (mode !== 'check' && mode !== 'setup') {
    throw new Error('Usage: bun run scripts/cloudflare-resources.ts <check|setup>')
  }

  await assertOauthSession()
  const config = await readConfig()
  const slug = config.vars.PRODUCT_SLUG
  const created = mode === 'setup' ? await setupMissing(slug) : []
  const remote = await snapshot(slug)

  const missing = [
    !remote.database && `D1:${slug}-production`,
    !remote.buckets.has(`${slug}-assets`) && `R2:${slug}-assets`,
    !remote.buckets.has(`${slug}-assets-preview`) && `R2:${slug}-assets-preview`,
    !remote.index && `Vectorize:${slug}-index`,
  ].filter(Boolean)
  if (missing.length > 0) throw new Error(`Missing Cloudflare resources: ${missing.join(', ')}`)
  if (remote.index?.config.dimensions !== 768 || remote.index.config.metric !== 'cosine') {
    throw new Error(`${slug}-index must use 768 dimensions and cosine distance`)
  }

  const database = remote.database
  if (!database) throw new Error('D1 resource disappeared during verification')
  const configuredDatabase = config.d1_databases.find((item) => item.binding === 'DB')
  if (mode === 'setup') {
    await writeDatabaseId(config, database.uuid)
    await runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote'])
  } else if (configuredDatabase?.database_id !== database.uuid) {
    throw new Error('wrangler.jsonc D1 database_id does not match the remote isolated database')
  }

  console.log(
    JSON.stringify({
      ok: true,
      auth: 'wrangler-oauth',
      product: slug,
      created,
      resources: {
        d1: `${slug}-production`,
        r2: [`${slug}-assets`, `${slug}-assets-preview`],
        vectorize: `${slug}-index`,
        vectorizeDimensions: 768,
        vectorizeMetric: 'cosine',
      },
      remoteMigrationApplied: mode === 'setup',
      productionWorkerDeployed: false,
    }),
  )
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
