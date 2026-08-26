import { z } from 'zod'

export const allowanceStateSchema = z.enum(['available', 'limited', 'exhausted', 'unknown'])

export const heartbeatSchema = z.object({
  allowanceState: allowanceStateSchema,
  remainingPercent: z.number().min(0).max(100).nullable(),
})

export const createJobSchema = z.object({
  task: z.string().trim().min(1).max(4_000),
  repository: z.string().trim().min(1).max(120),
  revision: z.string().trim().min(1).max(160),
})

export const completeJobSchema = z.object({
  jobId: z.string().uuid(),
  leaseToken: z.string().uuid(),
  outcome: z.enum(['completed', 'failed']),
  evidenceRef: z.string().trim().min(1).max(500),
})
