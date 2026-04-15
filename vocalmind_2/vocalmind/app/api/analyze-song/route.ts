import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { SONG_ANALYSIS_SYSTEM_PROMPT } from '@/lib/prompts/song-analysis';
import type { ApiError, SongSection, VocalTechnique } from '@/types';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 2000;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 5;           // 분당 5회
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 5_000;
const SWEEP_INTERVAL  = 60_000;
let lastSweep         = Date.now();

const GLOBAL_LIMIT       = 30;       // 시간당 30회
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
interface AnalyzeSongRequest {
  title: string;
  artist: string;
  melodyStats: {
    noteCount: number;
    avgFreq: number;
    minFreq: number;
    maxFreq: number;
    pitchChanges: number;
    repetitionPatterns: number;
  };
}

function validateRequest(body: unknown): AnalyzeSongRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  if (typeof b.title !== 'string' || b.title.trim().length === 0 || b.title.length > 200) return null;
  if (typeof b.artist !== 'string' || b.artist.trim().length === 0 || b.artist.length > 200) return null;

  const ms = b.melodyStats;
  if (!ms || typeof ms !== 'object') return null;
  const m = ms as Record<string, unknown>;

  if (typeof m.noteCount !== 'number' || m.noteCount < 0) return null;
  if (typeof m.avgFreq !== 'number' || m.avgFreq < 0) return null;
  if (typeof m.minFreq !== 'number' || m.minFreq < 0) return null;
  if (typeof m.maxFreq !== 'number' || m.maxFreq < 0) return null;
  if (typeof m.pitchChanges !== 'number' || m.pitchChanges < 0) return null;
  if (typeof m.repetitionPatterns !== 'number' || m.repetitionPatterns < 0) return null;

  return {
    title: b.title.trim(),
    artist: b.artist.trim(),
    melodyStats: {
      noteCount: m.noteCount,
      avgFreq: m.avgFreq,
      minFreq: m.minFreq,
      maxFreq: m.maxFreq,
      pitchChanges: m.pitchChanges,
      repetitionPatterns: m.repetitionPatterns,
    },
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────
const VALID_SECTION_TYPES = ['intro', 'verse', 'chorus', 'bridge', 'outro', 'other'] as const;
const VALID_TECHNIQUE_TYPES = ['vibrato', 'bending', 'belting', 'falsetto', 'whisper', 'run', 'crack', 'mix', 'breathy'] as const;

interface AIAnalysisResponse {
  sections: SongSection[];
  vocalMap: VocalTechnique[];
  songRange: { low: string; high: string };
  estimatedKey: string;
}

function parseAIResponse(text: string): AIAnalysisResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.sections) || parsed.sections.length < 1) return null;
    if (!parsed.songRange || typeof parsed.songRange.low !== 'string' || typeof parsed.songRange.high !== 'string') return null;
    if (typeof parsed.estimatedKey !== 'string') return null;

    // Validate sections
    const validSections: SongSection[] = [];
    for (const s of parsed.sections) {
      if (
        !VALID_SECTION_TYPES.includes(s.type) ||
        typeof s.startTime !== 'number' ||
        typeof s.endTime !== 'number' ||
        typeof s.label !== 'string' ||
        s.startTime < 0 ||
        s.endTime <= s.startTime
      ) {
        continue;
      }
      validSections.push({
        type: s.type,
        startTime: Math.round(s.startTime * 10) / 10,
        endTime: Math.round(s.endTime * 10) / 10,
        label: s.label.slice(0, 50),
      });
    }

    if (validSections.length < 1) return null;

    // Sort sections by startTime
    validSections.sort((a, b) => a.startTime - b.startTime);

    // Validate vocalMap
    const validVocalMap: VocalTechnique[] = [];
    if (Array.isArray(parsed.vocalMap)) {
      for (const v of parsed.vocalMap) {
        if (
          !VALID_TECHNIQUE_TYPES.includes(v.type) ||
          typeof v.startTime !== 'number' ||
          typeof v.endTime !== 'number' ||
          typeof v.intensity !== 'number' ||
          v.startTime < 0 ||
          v.endTime <= v.startTime
        ) {
          continue;
        }
        validVocalMap.push({
          type: v.type,
          startTime: Math.round(v.startTime * 10) / 10,
          endTime: Math.round(v.endTime * 10) / 10,
          intensity: Math.max(0, Math.min(1, Math.round(v.intensity * 100) / 100)),
        });
      }
    }

    return {
      sections: validSections,
      vocalMap: validVocalMap,
      songRange: {
        low: parsed.songRange.low.slice(0, 10),
        high: parsed.songRange.high.slice(0, 10),
      },
      estimatedKey: parsed.estimatedKey.slice(0, 30),
    };
  } catch {
    return null;
  }
}

// ── 핸들러 ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<AIAnalysisResponse | ApiError>> {
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
        { error: '유효하지 않은 요청입니다. 곡 제목, 아티스트, 멜로디 정보를 확인해주세요.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const userMessage = `
곡 정보:
- 제목: ${data.title}
- 아티스트: ${data.artist}

멜로디 분석 요약:
- 총 노트 수: ${data.melodyStats.noteCount}
- 평균 주파수: ${data.melodyStats.avgFreq.toFixed(1)}Hz
- 최저 주파수: ${data.melodyStats.minFreq.toFixed(1)}Hz
- 최고 주파수: ${data.melodyStats.maxFreq.toFixed(1)}Hz
- 급격한 피치 변화 횟수: ${data.melodyStats.pitchChanges}
- 반복 패턴 수: ${data.melodyStats.repetitionPatterns}

위 정보를 기반으로 곡의 구조와 보컬 테크닉을 분석하여 JSON 형식으로 응답해주세요.`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: SONG_ANALYSIS_SYSTEM_PROMPT,
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

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/analyze-song] ip=${ip} error=${message}`);

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
