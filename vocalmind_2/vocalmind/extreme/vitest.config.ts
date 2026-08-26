import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const workerKeys = {
  'codex-a': 'test-codex-a-worker-key',
  'codex-b': 'test-codex-b-worker-key',
  'supergrok-heavy': 'test-supergrok-worker-key',
  anthropic: 'test-anthropic-worker-key',
  'alibaba-token-plan': 'test-alibaba-worker-key',
  cursor: 'test-cursor-worker-key',
}

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: './src/test-worker.ts',
      remoteBindings: false,
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: 'test-only-better-auth-secret-with-32-characters',
          BETTER_AUTH_URL: 'https://example.test',
          CONTROL_PLANE_ADMIN_KEY: 'test-control-plane-admin-key',
          MIGRATION_MODE: 'shadow',
          SUBSCRIPTION_WORKER_AUTH_KEYS: JSON.stringify(workerKeys),
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'drizzle')),
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
})
