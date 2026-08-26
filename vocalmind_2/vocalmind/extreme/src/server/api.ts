import { Effect } from 'effect'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { AuthConfigurationError, authenticationConfiguration, createAuth } from '#/auth'
import { verifyAdminCredential, verifyWorkerCredential } from '#/control/auth'
import { isSubscriptionWorkerId } from '#/control/provider-pool'
import {
  listLearnerEvaluations,
  listLearnerProgress,
  readLearnerDashboard,
  upsertLearnerProgress,
} from '#/domain/learner'
import { migrationParity, readMigrationCounts } from '#/domain/migration'
import { runtimeHealth } from '#/effect/health'
import { listProductRecords, productContract } from '#/product'

type ApiContext = Context<{ Bindings: Env }>

function unauthorized(c: ApiContext) {
  return c.json({ ok: false, error: 'unauthorized' }, 401)
}

async function forwardToCoordinator(c: ApiContext, path: string, workerId?: string) {
  const coordinator = c.env.COORDINATOR.getByName(c.env.PRODUCT_SLUG)
  const headers = new Headers({
    'content-type': c.req.header('content-type') ?? 'application/json',
  })
  if (workerId) headers.set('x-authenticated-worker-id', workerId)
  const body =
    c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : await c.req.arrayBuffer()
  return coordinator.fetch(
    new Request(`https://coordinator.internal${path}`, {
      method: c.req.method,
      headers,
      body,
    }),
  )
}

async function authorizedWorker(c: ApiContext): Promise<string | null> {
  const workerId = c.req.header('x-tll-worker-id') ?? ''
  if (!isSubscriptionWorkerId(workerId)) return null
  const verified = await verifyWorkerCredential(
    workerId,
    c.req.header('authorization'),
    c.env.SUBSCRIPTION_WORKER_AUTH_KEYS,
  )
  return verified ? workerId : null
}

async function authenticatedUser(c: ApiContext) {
  const session = await createAuth(c.env, c.req.url).api.getSession({
    headers: c.req.raw.headers,
  })
  return session?.user ?? null
}

function boundedEvaluationLimit(rawValue: string | undefined) {
  const parsed = Number.parseInt(rawValue ?? '20', 10)
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 20, 1), 50)
}

const progressInput = z
  .object({
    stageId: z.number().int().min(1).max(28),
    score: z.number().int().min(0).max(100),
    passed: z.boolean(),
  })
  .strict()

const app = new Hono<{ Bindings: Env }>().basePath('/api')

export const api = app
  .use('*', async (c, next) => {
    await next()
    c.header('x-content-type-options', 'nosniff')
    c.header('cache-control', 'no-store')
    c.header('referrer-policy', 'strict-origin-when-cross-origin')
    c.header('x-frame-options', 'DENY')
  })
  .use(
    '/auth/*',
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ ok: false, error: 'payload_too_large' }, 413),
    }),
  )
  .all('/auth/*', async (c) => {
    try {
      return createAuth(c.env, c.req.url).handler(c.req.raw)
    } catch (error) {
      if (error instanceof AuthConfigurationError) {
        return c.json({ ok: false, error: 'authentication_not_configured' }, 503)
      }
      throw error
    }
  })
  .get('/health', async (c) => c.json(await Effect.runPromise(runtimeHealth)))
  .get('/ready', async (c) => {
    const auth = authenticationConfiguration(c.env, c.req.url)
    try {
      const [counts, assets] = await Promise.all([
        readMigrationCounts(c.env.DB),
        c.env.ASSETS.list({ limit: 1 }),
      ])
      const parity = migrationParity(counts)
      const bindings = {
        database: true,
        assets: Array.isArray(assets.objects),
        vectorize: Boolean(c.env.VECTORIZE),
        ai: Boolean(c.env.AI),
        coordinator: Boolean(c.env.COORDINATOR),
      }
      const ok =
        auth.configured &&
        parity.users &&
        parity.passwordCredentials &&
        parity.googleIdentities &&
        Object.values(bindings).every(Boolean)
      return c.json(
        {
          ok,
          mode: c.env.MIGRATION_MODE ?? 'shadow',
          auth: { configured: auth.configured },
          database: { ok: true, parity },
          bindings,
          paidCalls: 0,
        },
        ok ? 200 : 503,
      )
    } catch (error) {
      console.error('vocalmind_readiness_failed', error)
      return c.json(
        {
          ok: false,
          mode: c.env.MIGRATION_MODE ?? 'shadow',
          auth,
          database: { ok: false },
          error: 'runtime_not_ready',
        },
        503,
      )
    }
  })
  .get('/status', (c) => {
    const mode = c.env.MIGRATION_MODE ?? 'shadow'
    const publicProductionDeployed =
      mode === 'production' && String(c.env.PRODUCTION_AUTHORITY) === 'cloudflare'
    return c.json({
      ok: true,
      product: c.env.PRODUCT_SLUG,
      runtimeAuthority: publicProductionDeployed ? 'cloudflare' : 'cloudflare-candidate',
      productionAuthority: c.env.PRODUCTION_AUTHORITY,
      publicProductionDeployed,
      migrationMode: mode,
      stack: c.env.STACK,
      runtime: 'cloudflare-workers',
      framework: 'tanstack-start + hono-rpc + effect + drizzle',
      bindings: ['DB', 'ASSETS', 'VECTORIZE', 'AI', 'COORDINATOR'],
      durableObjectStorage: 'sqlite',
      subscriptionExecutionMode: c.env.SUBSCRIPTION_EXECUTION_MODE,
      directProviderApiExecution: false,
      legacy: {
        vercel: publicProductionDeployed ? 'disabled' : 'cutover-pending',
        nextjs: publicProductionDeployed ? 'disabled' : 'cutover-pending',
        supabase: 'snapshot-only',
      },
    })
  })
  .get('/migration/status', async (c) => {
    const counts = await readMigrationCounts(c.env.DB)
    const parity = migrationParity(counts)
    const detailed = await verifyAdminCredential(
      c.req.header('authorization'),
      c.env.CONTROL_PLANE_ADMIN_KEY,
    )
    return c.json({
      ok: parity.users && parity.passwordCredentials && parity.googleIdentities,
      mode: c.env.MIGRATION_MODE ?? 'shadow',
      sourceAuthority: 'supabase-snapshot',
      productionAuthority: c.env.PRODUCTION_AUTHORITY,
      parity,
      ...(detailed ? { counts } : {}),
    })
  })
  .get('/records', async (c) => {
    const user = await authenticatedUser(c)
    if (!user) return unauthorized(c)
    const items = await listProductRecords(c.env.DB, user.id)
    return c.json({ ok: true, source: 'd1', kind: productContract.recordKind, items })
  })
  .get('/me/dashboard', async (c) => {
    const user = await authenticatedUser(c)
    if (!user) return unauthorized(c)
    return c.json({
      ok: true,
      learner: await readLearnerDashboard(
        c.env.DB,
        user.id,
        boundedEvaluationLimit(c.req.query('limit')),
      ),
    })
  })
  .get('/me/progress', async (c) => {
    const user = await authenticatedUser(c)
    if (!user) return unauthorized(c)
    return c.json({ ok: true, progress: await listLearnerProgress(c.env.DB, user.id) })
  })
  .post(
    '/me/progress',
    bodyLimit({
      maxSize: 2 * 1024,
      onError: (c) => c.json({ ok: false, error: 'payload_too_large' }, 413),
    }),
    async (c) => {
      const user = await authenticatedUser(c)
      if (!user) return unauthorized(c)
      const body = await c.req.json().catch(() => null)
      const parsed = progressInput.safeParse(body)
      if (!parsed.success) return c.json({ ok: false, error: 'invalid_progress' }, 400)
      const progress = await upsertLearnerProgress(c.env.DB, user.id, parsed.data)
      return c.json({
        ok: true,
        progress: progress ? { ...progress, passed: progress.passed === 1 } : null,
      })
    },
  )
  .get('/me/evaluations', async (c) => {
    const user = await authenticatedUser(c)
    if (!user) return unauthorized(c)
    return c.json({
      ok: true,
      evaluations: await listLearnerEvaluations(
        c.env.DB,
        user.id,
        boundedEvaluationLimit(c.req.query('limit')),
      ),
    })
  })
  .get('/control/pool', async (c) => {
    const allowed = await verifyAdminCredential(
      c.req.header('authorization'),
      c.env.CONTROL_PLANE_ADMIN_KEY,
    )
    return allowed ? forwardToCoordinator(c, '/pool') : unauthorized(c)
  })
  .post('/control/jobs', async (c) => {
    const allowed = await verifyAdminCredential(
      c.req.header('authorization'),
      c.env.CONTROL_PLANE_ADMIN_KEY,
    )
    return allowed ? forwardToCoordinator(c, '/jobs') : unauthorized(c)
  })
  .post('/control/heartbeat', async (c) => {
    const workerId = await authorizedWorker(c)
    return workerId ? forwardToCoordinator(c, '/heartbeat', workerId) : unauthorized(c)
  })
  .post('/control/claim', async (c) => {
    const workerId = await authorizedWorker(c)
    return workerId ? forwardToCoordinator(c, '/claim', workerId) : unauthorized(c)
  })
  .post('/control/complete', async (c) => {
    const workerId = await authorizedWorker(c)
    return workerId ? forwardToCoordinator(c, '/complete', workerId) : unauthorized(c)
  })

api.notFound((c) => c.json({ ok: false, error: 'not_found' }, 404))
api.onError((error, c) => {
  if (error instanceof AuthConfigurationError) {
    return c.json({ ok: false, error: 'authentication_not_configured' }, 503)
  }
  console.error('tll_product_api_error', error)
  return c.json({ ok: false, error: 'internal_error' }, 500)
})

export type AppType = typeof api
