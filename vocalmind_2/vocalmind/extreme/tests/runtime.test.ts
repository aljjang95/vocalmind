import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { normalizeEmail } from '#/auth/email'
import {
  DIRECT_PROVIDER_API_EXECUTION,
  SUBSCRIPTION_WORKERS,
  selectSubscriptionWorker,
} from '#/control/provider-pool'
import { productContract } from '#/product'

const adminHeaders = {
  authorization: 'Bearer test-control-plane-admin-key',
  'content-type': 'application/json',
}

function responseCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
  const cookies = values
    .flatMap((value) => value.split(/,(?=[^;,]+=)/))
    .map((value) => value.split(';', 1)[0]?.trim())
    .filter(Boolean)
  if (cookies.length === 0) throw new Error('Authentication response did not set a cookie')
  return cookies.join('; ')
}

async function signInLegacyLearner() {
  const response = await SELF.fetch('https://example.test/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'learner-a@example.test',
      password: 'LegacyLearnerPass!2026',
    }),
  })
  expect(response.status).toBe(200)
  return responseCookies(response)
}

describe(`${productContract.slug} Cloudflare candidate`, () => {
  it('reports a truthful ready candidate without leaking operational counts', async () => {
    const health = await SELF.fetch('https://example.test/api/health')
    expect(await health.json()).toMatchObject({
      ok: true,
      service: 'vocalmind',
      directProviderApiExecution: false,
    })

    const status = await SELF.fetch('https://example.test/api/status')
    expect(await status.json()).toMatchObject({
      runtimeAuthority: 'cloudflare-candidate',
      productionAuthority: 'deployment-gated',
      migrationMode: 'shadow',
      publicProductionDeployed: false,
    })

    const ready = await SELF.fetch('https://example.test/api/ready')
    expect(ready.status).toBe(200)
    const readyBody = await ready.json()
    expect(readyBody).toMatchObject({
      ok: true,
      auth: { configured: true },
      database: {
        ok: true,
        parity: { users: true, passwordCredentials: true, googleIdentities: true },
      },
      paidCalls: 0,
    })
    expect(JSON.stringify(readyBody)).not.toContain('sourceUsers')

    const migration = await SELF.fetch('https://example.test/api/migration/status')
    const publicMigration = await migration.json()
    expect(publicMigration).not.toHaveProperty('counts')
    expect(publicMigration).toMatchObject({ ok: true })

    const detailed = await SELF.fetch('https://example.test/api/migration/status', {
      headers: adminHeaders,
    })
    expect(await detailed.json()).toMatchObject({
      counts: {
        sourceUsers: 2,
        sourcePasswordCredentials: 1,
        sourceGoogleIdentities: 1,
        importedUsers: 2,
        importedPasswordCredentials: 1,
        importedGoogleIdentities: 1,
        missingUsers: 0,
        missingPasswordCredentials: 0,
        missingGoogleIdentities: 0,
      },
    })
  })

  it('signs in a preserved bcrypt learner and isolates dashboard rows', async () => {
    expect((await SELF.fetch('https://example.test/api/me/dashboard')).status).toBe(401)
    const cookie = await signInLegacyLearner()
    const dashboard = await SELF.fetch('https://example.test/api/me/dashboard', {
      headers: { cookie },
    })
    expect(dashboard.status).toBe(200)
    const body = (await dashboard.json()) as {
      learner: {
        profile: { id: string }
        progress: Array<{ id: string }>
        evaluations: Array<{ id: string }>
      }
    }
    expect(body.learner.profile.id).toBe('legacy-learner-a')
    expect(body.learner.progress.map(({ id }) => id)).toEqual(['progress-a'])
    expect(body.learner.evaluations.map(({ id }) => id)).toEqual(['evaluation-a'])
    expect(JSON.stringify(body)).not.toContain('progress-b')
    expect(JSON.stringify(body)).not.toContain('evaluation-b')
  })

  it('upserts only the session learner progress and preserves the best result', async () => {
    const cookie = await signInLegacyLearner()
    const first = await SELF.fetch('https://example.test/api/me/progress', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ stageId: 1, score: 70, passed: false }),
    })
    expect(await first.json()).toMatchObject({
      ok: true,
      progress: { stage_id: 1, best_score: 82, attempts: 3, passed: true },
    })
    const second = await SELF.fetch('https://example.test/api/me/progress', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ stageId: 1, score: 94, passed: true }),
    })
    expect(await second.json()).toMatchObject({
      progress: { best_score: 94, attempts: 4, passed: true },
    })
    const rows = await SELF.fetch('https://example.test/api/me/progress', { headers: { cookie } })
    expect(JSON.stringify(await rows.json())).not.toContain('progress-b')
  })

  it('creates a learner profile and clears the session on sign-out', async () => {
    const signUp = await SELF.fetch('https://example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'new-learner@example.test',
        password: 'NewLearnerPass!2026',
        name: 'New Learner',
      }),
    })
    expect(signUp.status).toBe(200)
    const cookie = responseCookies(signUp)
    const dashboard = await SELF.fetch('https://example.test/api/me/dashboard', {
      headers: { cookie },
    })
    expect(await dashboard.json()).toMatchObject({
      learner: {
        profile: { email: 'new-learner@example.test', name: 'New Learner', role: 'free' },
        progress: [],
        evaluations: [],
      },
    })
    const signOut = await SELF.fetch('https://example.test/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'https://example.test' },
      body: '{}',
    })
    expect(signOut.status).toBe(200)
    const session = await SELF.fetch('https://example.test/api/auth/get-session', {
      headers: { cookie: responseCookies(signOut) },
    })
    expect(await session.json()).toBeNull()
  })

  it('rejects malformed or unauthenticated progress writes', async () => {
    const unauthenticated = await SELF.fetch('https://example.test/api/me/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stageId: 1, score: 90, passed: true }),
    })
    expect(unauthenticated.status).toBe(401)
    const cookie = await signInLegacyLearner()
    const invalid = await SELF.fetch('https://example.test/api/me/progress', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ stageId: 29, score: 101, passed: true }),
    })
    expect(invalid.status).toBe(400)
  })

  it('rejects oversized learner writes before parsing them', async () => {
    const cookie = await signInLegacyLearner()
    const oversized = await SELF.fetch('https://example.test/api/me/progress', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        stageId: 1,
        score: 90,
        passed: true,
        padding: 'x'.repeat(3 * 1024),
      }),
    })
    expect(oversized.status).toBe(413)
    expect(await oversized.json()).toMatchObject({ error: 'payload_too_large' })
  })

  it('preserves valid email identity semantics while normalizing casing', () => {
    expect(normalizeEmail(' Learner.Name+tag@GMAIL.com\u200B ')).toBe('learner.name+tag@gmail.com')
  })

  it('keeps the subscription worker pool fail-closed and paid providers disabled', () => {
    expect(DIRECT_PROVIDER_API_EXECUTION).toBe(false)
    expect(SUBSCRIPTION_WORKERS).toHaveLength(6)
    expect(selectSubscriptionWorker([])).toBeNull()
  })
})
