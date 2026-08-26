import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { progress } from '#/db/schema'

export const productContract = {
  slug: 'vocalmind',
  displayName: 'HLB 보컬스튜디오',
  pageTitle: 'HLB 보컬스튜디오 | 내 소리의 길',
  description: '내 보컬 진도와 최근 평가를 한곳에서 이어가는 개인 연습 데스크.',
  recordKind: 'progress',
} as const

export async function listProductRecords(database: D1Database, ownerId: string) {
  return drizzle(database).select().from(progress).where(eq(progress.userId, ownerId)).limit(28)
}
