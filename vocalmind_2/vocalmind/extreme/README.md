# Vocalmind Cloudflare candidate

Product-specific shadow candidate for the preserved Vocalmind account, HLB 28-stage progress, and evaluation data.

## Runtime

- Bun 1.4 toolchain
- TanStack Start + React
- Hono API boundaries
- Better Auth + bcrypt password continuity
- Drizzle + Cloudflare D1
- R2, Vectorize, Workers AI, and a SQLite Durable Object binding
- Effect for explicit runtime health effects

The candidate remains `shadow/deployment-gated`. It does not execute direct provider APIs or paid AI calls in readiness or verification flows.

## Verify locally

```bash
bun install --frozen-lockfile
bun run check
```

The test suite covers preserved bcrypt login, new signup and sign-out, learner-scoped profile/progress/evaluation reads, monotonic progress updates, malformed and oversized input rejection, and fail-closed subscription worker selection.

## Verify remotely

```bash
bun run resource:check
bun run db:migrate:remote
bun run verify:auth:remote
bun run verify:legacy-passwords:remote
```

Remote verifiers require the explicit confirmation flag already encoded in the package scripts. They use synthetic rows, verify A/B learner isolation, and restore baseline row counts. The legacy-password verifier never prints candidate values, emails, or hashes.

## Release gates

- Existing password continuity for the two imported email/password accounts
- Google OAuth execution for the two imported Google identities
- Desktop, 360px, empty/error, and reduced-motion screenshot QA

Do not change `PRODUCTION_AUTHORITY` to `cloudflare` until every gate is evidenced.
