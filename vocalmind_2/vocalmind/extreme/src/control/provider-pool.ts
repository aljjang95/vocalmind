export const SUBSCRIPTION_WORKERS = [
  { id: 'codex-a', provider: 'codex', subscription: 'codex-account-1', capacity: 1 },
  { id: 'codex-b', provider: 'codex', subscription: 'codex-account-2', capacity: 1 },
  {
    id: 'supergrok-heavy',
    provider: 'supergrok-heavy',
    subscription: 'supergrok-heavy-account-1',
    capacity: 1,
  },
  {
    id: 'anthropic',
    provider: 'anthropic',
    subscription: 'anthropic-account-1',
    capacity: 1,
  },
  {
    id: 'alibaba-token-plan',
    provider: 'alibaba-token-plan',
    subscription: 'alibaba-token-plan-account-1',
    capacity: 1,
  },
  { id: 'cursor', provider: 'cursor', subscription: 'cursor-account-1', capacity: 1 },
] as const

export type SubscriptionWorkerId = (typeof SUBSCRIPTION_WORKERS)[number]['id']
export type AllowanceState = 'available' | 'limited' | 'exhausted' | 'unknown'

export interface WorkerHeartbeat {
  workerId: SubscriptionWorkerId
  allowanceState: AllowanceState
  remainingPercent: number | null
  activeLeases: number
  lastHeartbeatAt: number
}

export const HEARTBEAT_TTL_MS = 120_000
export const JOB_LEASE_TTL_MS = 300_000
export const DIRECT_PROVIDER_API_EXECUTION = false as const

const workerById = new Map(SUBSCRIPTION_WORKERS.map((worker) => [worker.id, worker]))

export function isSubscriptionWorkerId(value: string): value is SubscriptionWorkerId {
  return workerById.has(value as SubscriptionWorkerId)
}

function scoreWorker(heartbeat: WorkerHeartbeat, now: number): number | null {
  const catalog = workerById.get(heartbeat.workerId)
  if (!catalog || now - heartbeat.lastHeartbeatAt > HEARTBEAT_TTL_MS) return null
  if (heartbeat.activeLeases >= catalog.capacity) return null
  if (heartbeat.allowanceState === 'exhausted' || heartbeat.allowanceState === 'unknown') {
    return null
  }
  if (heartbeat.remainingPercent !== null && heartbeat.remainingPercent <= 0) return null

  const allowanceScore =
    heartbeat.remainingPercent ?? (heartbeat.allowanceState === 'available' ? 50 : 10)
  const stateScore = heartbeat.allowanceState === 'available' ? 1_000 : 100
  const catalogOrder = SUBSCRIPTION_WORKERS.findIndex((worker) => worker.id === heartbeat.workerId)
  return stateScore + allowanceScore - catalogOrder / 100
}

export function selectSubscriptionWorker(
  heartbeats: readonly WorkerHeartbeat[],
  now = Date.now(),
): SubscriptionWorkerId | null {
  let selected: { id: SubscriptionWorkerId; score: number } | null = null

  for (const heartbeat of heartbeats) {
    const score = scoreWorker(heartbeat, now)
    if (score === null) continue
    if (!selected || score > selected.score) selected = { id: heartbeat.workerId, score }
  }

  return selected?.id ?? null
}
