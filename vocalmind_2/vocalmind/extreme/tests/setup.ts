import { type D1Migration, env } from 'cloudflare:test'
import bcrypt from 'bcryptjs'
import { beforeAll } from 'vitest'

interface TestBindings extends Env {
  TEST_MIGRATIONS: D1Migration[]
}

async function applyFixtureMigrations(db: D1Database, migrations: D1Migration[]) {
  for (const migration of migrations) {
    await db.batch(migration.queries.map((query) => db.prepare(query)))
  }
}

beforeAll(async () => {
  const bindings = env as TestBindings
  const cutoverIndex = bindings.TEST_MIGRATIONS.findIndex(
    ({ name }) => name === '0002_better_auth_cutover.sql',
  )
  if (cutoverIndex < 0) throw new Error('Better Auth cutover migration is missing')

  await applyFixtureMigrations(bindings.DB, bindings.TEST_MIGRATIONS.slice(0, cutoverIndex))

  const now = new Date('2026-08-23T00:00:00.000Z').toISOString()
  const legacyHash = (await bcrypt.hash('LegacyLearnerPass!2026', 4)).replace('$2b$', '$2a$')
  await bindings.DB.batch([
    bindings.DB.prepare(
      `INSERT INTO supabase_auth_users
        (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind('legacy-learner-a', 'learner-a@example.test', legacyHash, now, now, now),
    bindings.DB.prepare(
      `INSERT INTO supabase_auth_users
        (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
    ).bind('legacy-learner-b', 'learner-b@example.test', now, now, now),
    bindings.DB.prepare(
      `INSERT INTO supabase_auth_identities
        (id, provider_id, user_id, identity_data, provider, created_at, updated_at, email)
       VALUES (?, ?, ?, '{}', 'email', ?, ?, ?)`,
    ).bind(
      'identity-email-a',
      'learner-a@example.test',
      'legacy-learner-a',
      now,
      now,
      'learner-a@example.test',
    ),
    bindings.DB.prepare(
      `INSERT INTO supabase_auth_identities
        (id, provider_id, user_id, identity_data, provider, created_at, updated_at, email)
       VALUES (?, ?, ?, '{}', 'google', ?, ?, ?)`,
    ).bind(
      'identity-google-b',
      'google-provider-b',
      'legacy-learner-b',
      now,
      now,
      'learner-b@example.test',
    ),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_profiles
        (id, email, name, role, created_at, onboarding_result)
       VALUES (?, ?, ?, 'premium', ?, '{"completed":true}')`,
    ).bind('legacy-learner-a', 'learner-a@example.test', 'Learner A', now),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_profiles
        (id, email, name, role, created_at)
       VALUES (?, ?, ?, 'free', ?)`,
    ).bind('legacy-learner-b', 'learner-b@example.test', 'Learner B', now),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_progress
        (id, user_id, stage_id, best_score, attempts, passed, updated_at)
       VALUES ('progress-a', 'legacy-learner-a', 1, 82, 2, 1, ?)`,
    ).bind(now),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_progress
        (id, user_id, stage_id, best_score, attempts, passed, updated_at)
       VALUES ('progress-b', 'legacy-learner-b', 2, 91, 1, 1, ?)`,
    ).bind(now),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_evaluations
        (id, user_id, stage_id, score, pitch_accuracy, tone_stability,
         tension_detected, feedback, passed, created_at)
       VALUES ('evaluation-a', 'legacy-learner-a', 1, 82, 80, 0.84, 0, 'A only', 1, ?)`,
    ).bind(now),
    bindings.DB.prepare(
      `INSERT INTO supabase_public_evaluations
        (id, user_id, stage_id, score, pitch_accuracy, tone_stability,
         tension_detected, feedback, passed, created_at)
       VALUES ('evaluation-b', 'legacy-learner-b', 2, 91, 92, 0.91, 0, 'B only', 1, ?)`,
    ).bind(now),
  ])

  await applyFixtureMigrations(bindings.DB, bindings.TEST_MIGRATIONS.slice(cutoverIndex))
})
