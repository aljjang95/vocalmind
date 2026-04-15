import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { WARMUP_ROUTINE_SYSTEM_PROMPT } from '@/lib/prompts/warmup-routine';
import { ApiError, WarmupCondition, WarmupRoutine, WarmupStage, VoiceType } from '@/types';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 1500;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 10;        // 워밍업은 분당 10회
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 5_000;
const SWEEP_INTERVAL  = 60_000;
let lastSweep         = Date.now();

const GLOBAL_LIMIT       = 50;
const GLOBAL_WINDOW_MS   = 3600_000;
let globalCount          = 0;
let globalWindowStart    = Date.now();

function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  RATE_STORE.forEach((bucket, key) => {
    if (now - bucket.windowStart > RATE_WINDOW_MS) RATE_STORE.delete(key);
  });
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  sweepExpired(now);
  if (RATE_STORE.size >= RATE_STORE_MAX) {
    const firstKey = RATE_STORE.keys().next().value;
    if (firstKey !== undefined) RATE_STORE.delete(firstKey);
  }
  const bucket = RATE_STORE.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    RATE_STORE.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (bucket.count >= RATE_LIMIT) return true;
  bucket.count += 1;
  return false;
}

// ── 입력 검증 ───────────────────────────────────────────────
const VALID_ENERGY = ['good', 'normal', 'tired', 'bad'] as const;
const VALID_GOALS = [
  '고음 확장', '음정 안정', '호흡 강화', '음색 개선', '테크닉 연습', '가볍게 풀기',
] as const;
const VALID_VOICE_TYPES = ['저음', '중음', '고음'] as const;

interface WarmupRequest {
  condition: WarmupCondition;
  voiceType: VoiceType;
}

function validateRequest(body: unknown): WarmupRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  // condition
  const cond = b.condition;
  if (!cond || typeof cond !== 'object') return null;
  const c = cond as Record<string, unknown>;

  if (!VALID_ENERGY.includes(c.energy as typeof VALID_ENERGY[number])) return null;

  if (!Array.isArray(c.goals) || c.goals.length < 1 || c.goals.length > 2) return null;
  for (const g of c.goals) {
    if (!VALID_GOALS.includes(g as typeof VALID_GOALS[number])) return null;
  }

  // voiceType
  if (!VALID_VOICE_TYPES.includes(b.voiceType as typeof VALID_VOICE_TYPES[number])) return null;

  return {
    condition: {
      energy: c.energy as WarmupCondition['energy'],
      goals: c.goals as string[],
    },
    voiceType: b.voiceType as VoiceType,
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────
interface AIRoutineResponse {
  stages: Array<{
    stageId: number;
    suggestedBpm: number;
    repetitions: number;
    durationMin: number;
  }>;
  totalMinutes: number;
  aiComment: string;
}

function parseAIResponse(text: string): AIRoutineResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (
      !Array.isArray(parsed.stages) ||
      parsed.stages.length < 1 ||
      typeof parsed.totalMinutes !== 'number' ||
      typeof parsed.aiComment !== 'string'
    ) {
      return null;
    }

    // 각 stage 검증
    const validStages: AIRoutineResponse['stages'] = [];
    for (const s of parsed.stages) {
      if (
        typeof s.stageId !== 'number' ||
        typeof s.suggestedBpm !== 'number' ||
        typeof s.repetitions !== 'number' ||
        typeof s.durationMin !== 'number'
      ) {
        continue;
      }

      // 커리큘럼에 존재하는 id인지 확인
      const currStage = hlbCurriculum.find((cs) => cs.id === s.stageId);
      if (!currStage) continue;

      // BPM 범위 보정
      const clampedBpm = Math.max(currStage.bpmRange[0], Math.min(currStage.bpmRange[1], Math.round(s.suggestedBpm)));

      validStages.push({
        stageId: s.stageId,
        suggestedBpm: clampedBpm,
        repetitions: Math.max(1, Math.min(4, Math.round(s.repetitions))),
        durationMin: Math.max(0.5, Math.min(3, Math.round(s.durationMin * 2) / 2)),
      });
    }

    if (validStages.length < 1) return null;

    // totalMinutes 재계산
    const actualTotal = validStages.reduce((sum, s) => sum + s.durationMin, 0);

    return {
      stages: validStages,
      totalMinutes: Math.round(actualTotal * 10) / 10,
      aiComment: parsed.aiComment.slice(0, 500),
    };
  } catch {
    return null;
  }
}

// ── 에너지 한글 매핑 ─────────────────────────────────────
const ENERGY_LABELS: Record<WarmupCondition['energy'], string> = {
  good: '좋음',
  normal: '보통',
  tired: '피곤함',
  bad: '안 좋음',
};

// ── 핸들러 ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<WarmupRoutine | ApiError>> {
  const rawIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const ip = rawIp.replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45);

  // 글로벌 rate limit
  const now = Date.now();
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalCount = 0;
    globalWindowStart = now;
  }
  globalCount += 1;
  if (globalCount > GLOBAL_LIMIT) {
    return NextResponse.json(
      { error: '서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'GLOBAL_RATE_LIMITED' },
      { status: 503 }
    );
  }

  if (checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const data = validateRequest(body);

    if (!data) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다. 컨디션과 목표를 확인해주세요.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const userMessage = `
사용자 컨디션:
- 에너지 수준: ${ENERGY_LABELS[data.condition.energy]}
- 목표: ${data.condition.goals.join(', ')}
- 보이스 타입: ${data.voiceType}

위 정보를 기반으로 오늘의 워밍업 루틴을 JSON 형식으로 생성해주세요.`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: WARMUP_ROUTINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const aiText =
      response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

    const parsed = parseAIResponse(aiText);

    if (!parsed) {
      return NextResponse.json(
        { error: 'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    // WarmupStage 배열 구성 (커리큘럼 데이터 병합)
    const stages: WarmupStage[] = parsed.stages.map((ps) => {
      const curr = hlbCurriculum.find((c) => c.id === ps.stageId)!;
      return {
        stageId: curr.id,
        name: curr.name,
        pronunciation: curr.pronunciation,
        pattern: curr.pattern,
        bpmRange: curr.bpmRange,
        suggestedBpm: ps.suggestedBpm,
        repetitions: ps.repetitions,
        durationMin: ps.durationMin,
        guideText: curr.scaleType === '비발성'
          ? '바람만 부는 연습입니다. 소리 내지 마세요.'
          : `${curr.pronunciation}을(를) ${curr.scaleType} 패턴으로 발성하세요.`,
      };
    });

    const result: WarmupRoutine = {
      id: `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      condition: data.condition,
      stages,
      totalMinutes: parsed.totalMinutes,
      aiComment: parsed.aiComment,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/warmup] ip=${ip} error=${message}`);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'AI_RATE_LIMITED' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
