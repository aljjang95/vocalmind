import { Effect } from 'effect'
import { productContract } from '#/product'

export const runtimeHealth = Effect.sync(() => ({
  ok: true as const,
  service: productContract.slug,
  stack: 'tll-highend',
  authority: 'cloudflare',
  runtime: 'cloudflare-workers',
  framework: 'tanstack-start + hono-rpc + effect',
  subscriptionExecution: true,
  directProviderApiExecution: false,
  time: new Date().toISOString(),
}))
