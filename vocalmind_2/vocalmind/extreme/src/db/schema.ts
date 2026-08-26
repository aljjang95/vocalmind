import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const progress = sqliteTable(
  'supabase_public_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    stageId: integer('stage_id').notNull(),
    bestScore: integer('best_score').default(0),
    attempts: integer('attempts').default(0),
    passed: integer('passed', { mode: 'boolean' }).default(false),
    updatedAt: text('updated_at'),
  },
  (table) => [
    uniqueIndex('supabase_public_progress_user_stage_uidx').on(table.userId, table.stageId),
  ],
)
