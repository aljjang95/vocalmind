import 'server-only';

// ── 백엔드 기본 URL ────────────────────────────────────────────
// VOCAL_BACKEND_URL 환경변수 우선, 없으면 로컬 개발 서버 폴백
const BACKEND_URL = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';

// ── 공통 에러 타입 ─────────────────────────────────────────────
export interface BackendError {
  error: string;
  code: string;
  status: number;
}

// ── 백엔드 응답 래퍼 타입 ─────────────────────────────────────
export type BackendResult<T> =
  | { success: true; data: T }
  | { success: false; error: BackendError };

// ── 음성 평가 요청/응답 타입 ──────────────────────────────────
export interface EvaluateRequest {
  audio: File;
  stageId: string;
  targetPitches?: string; // JSON 문자열 (기본값 '[]')
}

export interface EvaluateResponse {
  score: number;
  pitch_accuracy: number;
  tone_stability: number;
  tension_detected: boolean;
  tension?: Record<string, unknown>;
  feedback: string;
  passed: boolean;
}

// ── 온보딩 분석 응답 타입 ─────────────────────────────────────
export interface OnboardingAnalyzeResponse {
  tension: {
    overall: number;
    laryngeal: number;
    tongue_root: number;
    jaw: number;
    register_break: number;
    detail: string;
  };
  consultation: {
    problems: string[];
    roadmap: string[];
    suggested_stage_id: number;
    summary: string;
  };
}

// ── TTS 응답: ArrayBuffer (audio/mpeg) ────────────────────────
export type TtsResponse = ArrayBuffer;

// ── 코치 피드백 요청/응답 타입 ───────────────────────────────
export interface CoachFeedbackRequest {
  stage_id: string;
  user_message: string;
  score?: number;
  pitch_accuracy?: number;
  tension_detail?: string;
  jitter?: number;
  shimmer?: number;
  hnr_db?: number;
  avg_pitch_hz?: number;
}

export interface CoachFeedbackResponse {
  feedback: string;
  next_exercise: string;
  encouragement: string;
  references?: Array<{ videoId: string; timestamp: number }>;
}

// ── 보컬 DNA 분석 응답 타입 ──────────────────────────────────
export interface VocalDnaResponse {
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  tone_stability: number;
  avg_pitch_hz: number | null;
  voice_type: string | null;
}

// ── 내부 헬퍼: 백엔드 fetch + 에러 정규화 ────────────────────
async function backendFetch<T>(
  path: string,
  init: RequestInit,
): Promise<BackendResult<T>> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, init);

    if (!res.ok) {
      // 백엔드가 JSON 에러를 반환하면 파싱, 아니면 HTTP 상태 코드 기반 메시지
      const body = await res.json().catch(() => null) as { error?: string; detail?: string } | null;
      return {
        success: false,
        error: {
          error: body?.error ?? body?.detail ?? '백엔드 서버 오류',
          code: 'BACKEND_ERROR',
          status: res.status,
        },
      };
    }

    const data = await res.json() as T;
    return { success: true, data };
  } catch {
    // 네트워크 연결 실패
    return {
      success: false,
      error: {
        error: '백엔드 서버에 연결할 수 없습니다',
        code: 'BACKEND_UNREACHABLE',
        status: 502,
      },
    };
  }
}

/**
 * 음성 평가 요청을 Python 백엔드 /evaluate 엔드포인트로 전달합니다.
 */
export async function evaluate(
  req: EvaluateRequest,
): Promise<BackendResult<EvaluateResponse>> {
  const form = new FormData();
  form.append('audio', req.audio, req.audio.name || 'recording.webm');
  form.append('stage_id', req.stageId);
  form.append('target_pitches', req.targetPitches ?? '[]');

  return backendFetch<EvaluateResponse>('/evaluate', { method: 'POST', body: form });
}

/**
 * 온보딩 음성 분석을 Python 백엔드 /onboarding/analyze로 전달합니다.
 * 긴장도 4축 + 상담 로드맵을 반환합니다.
 */
export async function analyzeOnboarding(
  audio: File | Blob,
  filename = 'recording.webm',
): Promise<BackendResult<OnboardingAnalyzeResponse>> {
  const form = new FormData();
  form.append('audio', audio, filename);

  return backendFetch<OnboardingAnalyzeResponse>('/onboarding/analyze', {
    method: 'POST',
    body: form,
  });
}

/**
 * edge-tts 음성 합성 요청. 응답은 audio/mpeg ArrayBuffer입니다.
 * fetch 실패 시 BackendError를 반환합니다.
 */
export async function tts(
  text: string,
): Promise<BackendResult<TtsResponse>> {
  try {
    const res = await fetch(`${BACKEND_URL}/onboarding/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: {
          error: 'TTS 생성 실패',
          code: 'TTS_ERROR',
          status: res.status,
        },
      };
    }

    const buffer = await res.arrayBuffer();
    return { success: true, data: buffer };
  } catch {
    return {
      success: false,
      error: {
        error: '백엔드 서버에 연결할 수 없습니다',
        code: 'BACKEND_UNREACHABLE',
        status: 502,
      },
    };
  }
}

/**
 * RAG 기반 AI 코치 피드백 요청 (/coach).
 * vocal_curriculum + vocal_feedback ChromaDB 이중 검색 결과를 반환합니다.
 */
export async function coachFeedback(
  req: CoachFeedbackRequest,
): Promise<BackendResult<CoachFeedbackResponse>> {
  return backendFetch<CoachFeedbackResponse>('/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

/**
 * 보컬 DNA 5축 분석 요청 (/vocal-dna/analyze).
 * 오디오에서 후두/혀뿌리/턱/성구전환/음색 안정도를 측정합니다.
 */
export async function vocalDna(
  audio: File | Blob,
  filename = 'recording.webm',
): Promise<BackendResult<VocalDnaResponse>> {
  const form = new FormData();
  form.append('audio', audio, filename);

  return backendFetch<VocalDnaResponse>('/vocal-dna/analyze', {
    method: 'POST',
    body: form,
  });
}
