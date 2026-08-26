import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { api } from '#/server/api'

const handler = ({ request }: { request: Request }) => api.fetch(request, env)

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    },
  },
})
