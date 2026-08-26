import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzle } from 'drizzle-orm/d1'
import { authSchema } from '#/db/auth-schema'
import { normalizeEmail } from './email'
import { hashPassword, verifyPassword } from './password'

type AuthEnv = Env & {
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
}

export class AuthConfigurationError extends Error {}

export function authenticationConfiguration(env: AuthEnv, requestUrl: string) {
  const secretConfigured = Boolean(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32)
  const configuredUrl = env.BETTER_AUTH_URL
  let originMatches = false

  if (configuredUrl) {
    try {
      originMatches = new URL(configuredUrl).origin === new URL(requestUrl).origin
    } catch {
      originMatches = false
    }
  }

  return {
    configured: secretConfigured && Boolean(configuredUrl) && originMatches,
    secretConfigured,
    urlConfigured: Boolean(configuredUrl),
    originMatches,
  }
}

export function createAuth(env: AuthEnv, requestUrl: string) {
  const configuration = authenticationConfiguration(env, requestUrl)
  if (!configuration.secretConfigured) {
    throw new AuthConfigurationError(
      'BETTER_AUTH_SECRET must be configured with at least 32 characters',
    )
  }
  if (!configuration.urlConfigured) {
    throw new AuthConfigurationError('BETTER_AUTH_URL must be configured')
  }
  if (!configuration.originMatches) {
    throw new AuthConfigurationError('Authentication origin does not match')
  }

  const baseURL = new URL(env.BETTER_AUTH_URL as string).origin
  const db = drizzle(env.DB, { schema: authSchema })

  return betterAuth({
    appName: 'HLB 보컬스튜디오',
    baseURL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = normalizeEmail(user.email)
            const existing = await env.DB.prepare(
              'SELECT id FROM supabase_public_profiles WHERE lower(trim(email)) = ? LIMIT 1',
            )
              .bind(email)
              .first<{ id: string }>()
            if (existing) {
              throw new APIError('CONFLICT', {
                message: 'An account already exists for this email',
              })
            }
            return {
              data: {
                ...user,
                email,
                name: user.name.trim() || email.split('@')[0] || '보컬마인드 학습자',
              },
            }
          },
          after: async (user) => {
            await env.DB.prepare(
              `INSERT INTO supabase_public_profiles
                (id, email, name, role, created_at)
               VALUES (?, ?, ?, 'free', ?)
               ON CONFLICT(id) DO UPDATE SET
                 email = excluded.email,
                 name = CASE
                   WHEN supabase_public_profiles.name = '' THEN excluded.name
                   ELSE supabase_public_profiles.name
                 END`,
            )
              .bind(user.id, normalizeEmail(user.email), user.name, new Date().toISOString())
              .run()
          },
        },
      },
    },
    advanced: {
      database: {
        generateId: 'uuid',
        joins: false,
      },
    },
  })
}
