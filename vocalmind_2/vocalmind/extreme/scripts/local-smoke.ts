import { createServer as createPortProbe } from 'node:net'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { productContract } from '../src/product'

const root = fileURLToPath(new URL('../', import.meta.url))

async function availablePort() {
  const probe = createPortProbe()
  const port = await new Promise<number>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a local smoke port'))
        return
      }
      resolve(address.port)
    })
  })
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

async function run(command: string[]): Promise<void> {
  const process_ = Bun.spawn(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process_.stdout).text(),
    new Response(process_.stderr).text(),
    process_.exited,
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || command.join(' '))
}

await run(['bun', 'x', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'])

const port = await availablePort()
const baseUrl = `http://127.0.0.1:${port}`
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port, strictPort: true },
  logLevel: 'error',
})

try {
  await server.listen()
  const [home, health, status, dashboard, migration, ready] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/api/status`),
    fetch(`${baseUrl}/api/me/dashboard`),
    fetch(`${baseUrl}/api/migration/status`),
    fetch(`${baseUrl}/api/ready`),
  ])
  const homeText = await home.text()
  const healthJson = (await health.json()) as { ok?: boolean }
  const statusJson = (await status.json()) as { directProviderApiExecution?: boolean }
  const dashboardJson = (await dashboard.json()) as { error?: string }
  const migrationJson = (await migration.json()) as {
    ok?: boolean
    parity?: { users?: boolean; passwordCredentials?: boolean; googleIdentities?: boolean }
  }
  const readyJson = (await ready.json()) as {
    ok?: boolean
    paidCalls?: number
    auth?: { configured?: boolean }
  }

  if (!home.ok || !homeText.includes(productContract.displayName)) {
    throw new Error('TanStack Start Vocalmind home flow failed')
  }
  if (!health.ok || healthJson.ok !== true) throw new Error('Hono health flow failed')
  if (!status.ok || statusJson.directProviderApiExecution !== false) {
    throw new Error('Runtime boundary status failed')
  }
  if (dashboard.status !== 503 || dashboardJson.error !== 'authentication_not_configured') {
    throw new Error('Learner dashboard did not fail closed without a local auth secret')
  }
  if (
    !migration.ok ||
    migrationJson.ok !== true ||
    migrationJson.parity?.users !== true ||
    migrationJson.parity.passwordCredentials !== true ||
    migrationJson.parity.googleIdentities !== true
  ) {
    throw new Error('D1 learner migration parity flow failed')
  }
  if (
    ready.status !== 503 ||
    readyJson.ok !== false ||
    readyJson.auth?.configured !== false ||
    readyJson.paidCalls !== 0
  ) {
    throw new Error('Local readiness did not fail closed without a secret')
  }

  console.log(
    JSON.stringify({
      ok: true,
      runtime: 'workerd-via-cloudflare-vite-plugin',
      routes: [
        '/',
        '/api/health',
        '/api/status',
        '/api/me/dashboard',
        '/api/migration/status',
        '/api/ready',
      ],
      learnerDashboardFailClosedStatus: dashboard.status,
      readinessFailClosedStatus: ready.status,
      migrationParity: migrationJson.parity,
      paidCalls: readyJson.paidCalls,
    }),
  )
} finally {
  await server.close()
}

process.exit(0)
