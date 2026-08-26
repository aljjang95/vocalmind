export type LearnerProfile = {
  id: string
  email: string
  name: string | null
  role: string
  has_onboarding_result: number
}

export type LearnerProgress = {
  id: string
  stage_id: number
  best_score: number
  attempts: number
  passed: number
  updated_at: string | null
}

export type LearnerEvaluation = {
  id: string
  stage_id: number
  score: number | null
  pitch_accuracy: number | null
  tone_stability: number | null
  tension_detected: number
  feedback: string
  passed: number
  created_at: string | null
}

export type ProgressInput = {
  stageId: number
  score: number
  passed: boolean
}

export async function readLearnerProfile(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT id, email, name, role,
              CASE WHEN onboarding_result IS NOT NULL AND trim(onboarding_result) <> '' THEN 1 ELSE 0 END
                AS has_onboarding_result
       FROM supabase_public_profiles
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(userId)
    .first<LearnerProfile>()
}

export async function listLearnerProgress(db: D1Database, userId: string) {
  const result = await db
    .prepare(
      `SELECT id, stage_id, COALESCE(best_score, 0) AS best_score,
              COALESCE(attempts, 0) AS attempts, COALESCE(passed, 0) AS passed, updated_at
       FROM supabase_public_progress
       WHERE user_id = ?
       ORDER BY stage_id ASC`,
    )
    .bind(userId)
    .all<LearnerProgress>()
  return result.results.map((row) => ({ ...row, passed: row.passed === 1 }))
}

export async function listLearnerEvaluations(db: D1Database, userId: string, limit: number) {
  const result = await db
    .prepare(
      `SELECT id, stage_id, score, pitch_accuracy, tone_stability,
              COALESCE(tension_detected, 0) AS tension_detected,
              COALESCE(feedback, '') AS feedback, COALESCE(passed, 0) AS passed, created_at
       FROM supabase_public_evaluations
       WHERE user_id = ?
       ORDER BY created_at DESC, id ASC
       LIMIT ?`,
    )
    .bind(userId, limit)
    .all<LearnerEvaluation>()
  return result.results.map((row) => ({
    ...row,
    tension_detected: row.tension_detected === 1,
    passed: row.passed === 1,
  }))
}

export async function upsertLearnerProgress(db: D1Database, userId: string, input: ProgressInput) {
  const id = `progress:${userId}:${input.stageId}`
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO supabase_public_progress
        (id, user_id, stage_id, best_score, attempts, passed, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(user_id, stage_id) DO UPDATE SET
         best_score = MAX(COALESCE(supabase_public_progress.best_score, 0), excluded.best_score),
         attempts = COALESCE(supabase_public_progress.attempts, 0) + 1,
         passed = MAX(COALESCE(supabase_public_progress.passed, 0), excluded.passed),
         updated_at = excluded.updated_at`,
    )
    .bind(id, userId, input.stageId, input.score, input.passed ? 1 : 0, now)
    .run()

  return db
    .prepare(
      `SELECT id, stage_id, COALESCE(best_score, 0) AS best_score,
              COALESCE(attempts, 0) AS attempts, COALESCE(passed, 0) AS passed, updated_at
       FROM supabase_public_progress
       WHERE user_id = ? AND stage_id = ?
       LIMIT 1`,
    )
    .bind(userId, input.stageId)
    .first<LearnerProgress>()
}

export async function readLearnerDashboard(
  db: D1Database,
  userId: string,
  evaluationLimit: number,
) {
  const [profile, progress, evaluations] = await Promise.all([
    readLearnerProfile(db, userId),
    listLearnerProgress(db, userId),
    listLearnerEvaluations(db, userId, evaluationLimit),
  ])
  const completedStages = progress.filter(({ passed }) => passed).length
  const lastStage = progress.reduce((maximum, item) => Math.max(maximum, item.stage_id), 0)

  return {
    profile,
    progress,
    evaluations,
    summary: {
      totalStages: 28,
      completedStages,
      totalAttempts: progress.reduce((sum, item) => sum + item.attempts, 0),
      nextStage: Math.min(Math.max(lastStage + 1, 1), 28),
    },
  }
}
