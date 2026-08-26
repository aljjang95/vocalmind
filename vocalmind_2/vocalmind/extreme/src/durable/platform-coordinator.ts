import { DurableObject } from 'cloudflare:workers'
import { hashLeaseToken } from '#/control/auth'
import { completeJobSchema, createJobSchema, heartbeatSchema } from '#/control/contracts'
import {
  isSubscriptionWorkerId,
  JOB_LEASE_TTL_MS,
  SUBSCRIPTION_WORKERS,
  type SubscriptionWorkerId,
  selectSubscriptionWorker,
  type WorkerHeartbeat,
} from '#/control/provider-pool'

interface HeartbeatRow {
  [key: string]: SqlStorageValue
  worker_id: SubscriptionWorkerId
  allowance_state: WorkerHeartbeat['allowanceState']
  remaining_percent: number | null
  last_heartbeat_at: number
  active_leases: number
}

interface JobRow {
  [key: string]: SqlStorageValue
  id: string
  repository: string
  revision: string
  task: string
  status: string
  assigned_worker_id: SubscriptionWorkerId | null
  lease_token_hash: string | null
  lease_expires_at: number | null
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export class PlatformCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_id TEXT PRIMARY KEY,
        allowance_state TEXT NOT NULL,
        remaining_percent REAL,
        last_heartbeat_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        repository TEXT NOT NULL,
        revision TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_worker_id TEXT,
        lease_token_hash TEXT,
        lease_expires_at INTEGER,
        evidence_ref TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs(status, created_at);
    `)
  }

  async fetch(request: Request): Promise<Response> {
    try {
      this.failExpiredLeases(Date.now())
      const path = new URL(request.url).pathname
      if (request.method === 'GET' && path === '/pool') return this.poolStatus()
      if (request.method === 'POST' && path === '/heartbeat') return this.heartbeat(request)
      if (request.method === 'POST' && path === '/jobs') return this.createJob(request)
      if (request.method === 'POST' && path === '/claim') return this.claim(request)
      if (request.method === 'POST' && path === '/complete') return this.complete(request)
      return json({ ok: false, error: 'coordinator_route_not_found' }, 404)
    } catch (error) {
      console.error('platform_coordinator_error', error)
      return json({ ok: false, error: 'coordinator_internal_error' }, 500)
    }
  }

  private authenticatedWorker(request: Request): SubscriptionWorkerId | null {
    const workerId = request.headers.get('x-authenticated-worker-id') ?? ''
    return isSubscriptionWorkerId(workerId) ? workerId : null
  }

  private async heartbeat(request: Request): Promise<Response> {
    const workerId = this.authenticatedWorker(request)
    if (!workerId) return json({ ok: false, error: 'worker_identity_required' }, 401)
    const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return json({ ok: false, error: 'invalid_heartbeat' }, 400)

    const now = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO worker_heartbeats (
        worker_id, allowance_state, remaining_percent, last_heartbeat_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(worker_id) DO UPDATE SET
        allowance_state = excluded.allowance_state,
        remaining_percent = excluded.remaining_percent,
        last_heartbeat_at = excluded.last_heartbeat_at`,
      workerId,
      parsed.data.allowanceState,
      parsed.data.remainingPercent,
      now,
    )
    return json({ ok: true, workerId, acceptedAt: now })
  }

  private async createJob(request: Request): Promise<Response> {
    const parsed = createJobSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return json({ ok: false, error: 'invalid_job' }, 400)

    const now = Date.now()
    const id = crypto.randomUUID()
    this.ctx.storage.sql.exec(
      `INSERT INTO jobs (
        id, repository, revision, task, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
      id,
      parsed.data.repository,
      parsed.data.revision,
      parsed.data.task,
      now,
      now,
    )
    return json({ ok: true, jobId: id, status: 'queued' }, 201)
  }

  private async claim(request: Request): Promise<Response> {
    const workerId = this.authenticatedWorker(request)
    if (!workerId) return json({ ok: false, error: 'worker_identity_required' }, 401)

    const heartbeats = this.heartbeatSnapshot()
    const preferredWorkerId = selectSubscriptionWorker(heartbeats)
    if (!preferredWorkerId)
      return json({ ok: false, error: 'no_eligible_subscription_worker' }, 409)
    if (preferredWorkerId !== workerId) {
      return json({ ok: false, error: 'higher_allowance_worker_available' }, 409)
    }

    const activeLease = [
      ...this.ctx.storage.sql.exec<{ count: number }>(
        `SELECT COUNT(*) AS count FROM jobs
         WHERE assigned_worker_id = ? AND status = 'running'`,
        workerId,
      ),
    ][0]
    if ((activeLease?.count ?? 0) > 0) return json({ ok: false, error: 'worker_at_capacity' }, 409)

    const job = [
      ...this.ctx.storage.sql.exec<JobRow>(
        `SELECT id, repository, revision, task, status, assigned_worker_id,
                lease_token_hash, lease_expires_at
         FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`,
      ),
    ][0]
    if (!job) return json({ ok: true, job: null })

    const now = Date.now()
    const leaseToken = crypto.randomUUID()
    const leaseTokenHash = await hashLeaseToken(leaseToken)
    const leaseExpiresAt = now + JOB_LEASE_TTL_MS
    this.ctx.storage.sql.exec(
      `UPDATE jobs SET status = 'running', assigned_worker_id = ?, lease_token_hash = ?,
        lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'`,
      workerId,
      leaseTokenHash,
      leaseExpiresAt,
      now,
      job.id,
    )

    return json({
      ok: true,
      job: {
        id: job.id,
        repository: job.repository,
        revision: job.revision,
        task: job.task,
        leaseToken,
        leaseExpiresAt,
      },
    })
  }

  private async complete(request: Request): Promise<Response> {
    const workerId = this.authenticatedWorker(request)
    if (!workerId) return json({ ok: false, error: 'worker_identity_required' }, 401)
    const parsed = completeJobSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return json({ ok: false, error: 'invalid_completion' }, 400)

    const job = [
      ...this.ctx.storage.sql.exec<JobRow>(
        `SELECT id, repository, revision, task, status, assigned_worker_id,
                lease_token_hash, lease_expires_at FROM jobs WHERE id = ?`,
        parsed.data.jobId,
      ),
    ][0]
    if (job?.status !== 'running' || job.assigned_worker_id !== workerId) {
      return json({ ok: false, error: 'active_lease_not_found' }, 409)
    }
    if ((job.lease_expires_at ?? 0) <= Date.now()) {
      this.failExpiredLeases(Date.now())
      return json({ ok: false, error: 'lease_expired' }, 409)
    }
    const presentedHash = await hashLeaseToken(parsed.data.leaseToken)
    if (presentedHash !== job.lease_token_hash) {
      return json({ ok: false, error: 'lease_mismatch' }, 409)
    }

    const now = Date.now()
    this.ctx.storage.sql.exec(
      `UPDATE jobs SET status = ?, evidence_ref = ?, lease_token_hash = NULL,
        lease_expires_at = NULL, updated_at = ? WHERE id = ?`,
      parsed.data.outcome,
      parsed.data.evidenceRef,
      now,
      job.id,
    )
    return json({ ok: true, jobId: job.id, status: parsed.data.outcome })
  }

  private heartbeatSnapshot(): WorkerHeartbeat[] {
    const rows = [
      ...this.ctx.storage.sql.exec<HeartbeatRow>(`
        SELECT h.worker_id, h.allowance_state, h.remaining_percent, h.last_heartbeat_at,
          (SELECT COUNT(*) FROM jobs j
           WHERE j.assigned_worker_id = h.worker_id AND j.status = 'running') AS active_leases
        FROM worker_heartbeats h
      `),
    ]
    return rows.map((row) => ({
      workerId: row.worker_id,
      allowanceState: row.allowance_state,
      remainingPercent: row.remaining_percent,
      activeLeases: row.active_leases,
      lastHeartbeatAt: row.last_heartbeat_at,
    }))
  }

  private poolStatus(): Response {
    const heartbeatById = new Map(this.heartbeatSnapshot().map((item) => [item.workerId, item]))
    const now = Date.now()
    return json({
      ok: true,
      directProviderApiExecution: false,
      selectedWorkerId: selectSubscriptionWorker([...heartbeatById.values()], now),
      workers: SUBSCRIPTION_WORKERS.map((worker) => {
        const heartbeat = heartbeatById.get(worker.id)
        return {
          id: worker.id,
          provider: worker.provider,
          capacity: worker.capacity,
          allowanceState: heartbeat?.allowanceState ?? 'unknown',
          remainingPercent: heartbeat?.remainingPercent ?? null,
          activeLeases: heartbeat?.activeLeases ?? 0,
          heartbeatFresh: heartbeat ? now - heartbeat.lastHeartbeatAt <= 120_000 : false,
        }
      }),
    })
  }

  private failExpiredLeases(now: number): void {
    this.ctx.storage.sql.exec(
      `UPDATE jobs SET status = 'failed', evidence_ref = 'lease-expired-fail-closed',
        lease_token_hash = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE status = 'running' AND lease_expires_at <= ?`,
      now,
      now,
    )
  }
}
