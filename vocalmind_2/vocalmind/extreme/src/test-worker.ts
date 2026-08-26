import { api } from '#/server/api'

export { PlatformCoordinator } from '#/durable/platform-coordinator'

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return api.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
