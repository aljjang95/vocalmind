// ─────────────────────────────────────────────
// Paradigm A Phase 0 — AI 스튜디오 타입
// DB 스키마: 20260418_studio_phase0.sql
// ─────────────────────────────────────────────

export type StudioJobStatus =
  | 'pending'
  | 'vocal_separating'
  | 'vocal_rvc'
  | 'vocal_mixing'
  | 'scene_planning'
  | 'scene_image_gen'
  | 'scene_video_gen'
  | 'lipsync'
  | 'composing'
  | 'formatting'
  | 'watermarking'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'refunded';

export type StylePreset = 'cinematic' | 'cozy' | 'neon_city' | 'fantasy' | 'retro' | 'ghibli';

// ── Phase 0+ 품질 티어 (2026-04-18) ──
// 마스터 각인: "최고 품질을 겨냥하되 낭비 방지."
// 백엔드 infra/runware_catalog.py TIERS와 동일 값 유지.
export type QualityTier = 'draft' | 'pro' | 'studio';

export type AvatarMode = 'user_photo' | 'ai_realistic' | 'ai_anime' | 'faceless';

export type VoiceIdentityStatus =
  | 'collecting'
  | 'training'
  | 'ready'
  | 'failed'
  | 'archived';

export type ModerationCategory =
  | 'nsfw'
  | 'minor_face'
  | 'celebrity_lookalike'
  | 'lyrics_policy'
  | 'voice_not_owner'
  | 'dmca'
  | 'other';

export type CreditReason =
  | 'signup_bonus'
  | 'topup_purchase'
  | 'cover_consume'
  | 'scene_regen'
  | 'job_refund'
  | 'referral'
  | 'admin_adjust';

// ── Scene Plan (studio_jobs.scene_plan JSONB) ──

export interface ScenePlanItem {
  id: string;
  prompt: string;
  durationSec: number;
  imageUrl?: string;
  videoUrl?: string;
}

export interface ScenePlan {
  scenes: ScenePlanItem[];
  lyricsUsed?: string;
}

// ── 핵심 엔티티 ──

export interface StudioJob {
  id: string;
  userId: string;
  voiceIdentityId: string | null;
  userMrPath: string;
  rawRecordingPath: string;
  stylePreset: StylePreset;
  avatarMode: AvatarMode;
  avatarRefPath: string | null;

  status: StudioJobStatus;
  progressPct: number;
  currentStepLabel: string | null;

  qualityTier: QualityTier;
  budgetUsd: number;
  costCredits: number;
  ledgerEntryId: number | null;
  costUsdEstimated: number | null;
  costUsdActual: number;

  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  failedStep: string | null;

  vocalsPath: string | null;
  instrumentalPath: string | null;
  convertedVocalsPath: string | null;
  finalVocalMixPath: string | null;
  scenePlan: ScenePlan | null;
  landscapeUrl: string | null;
  portraitUrl: string | null;
  thumbnailUrl: string | null;

  title: string | null;
  description: string | null;
  c2paSigned: boolean;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface VoiceIdentity {
  id: string;
  userId: string;
  status: VoiceIdentityStatus;
  rvcModelPath: string | null;
  rvcIndexPath: string | null;
  sourceClipCount: number;
  totalDurationSec: number;
  mosScore: number | null;
  livenessVerified: boolean;
  livenessMethod: string | null;
  lastError: string | null;
  createdAt: string;
  readyAt: string | null;
}

export interface Cover {
  id: string;
  userId: string;
  jobId: string;
  title: string;
  landscapeUrl: string;
  portraitUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  snsUploadable: boolean; // Phase 0은 항상 false
  createdAt: string;
}

export interface CreditLedgerEntry {
  id: number;
  userId: string;
  delta: number;
  reason: CreditReason;
  jobId: string | null;
  paymentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreditBalance {
  balance: number;
}

export interface ModerationEvent {
  id: number;
  userId: string;
  jobId: string | null;
  category: ModerationCategory;
  severity: 'warn' | 'block' | 'review';
  detail: Record<string, unknown>;
  decidedBy: string;
  createdAt: string;
}

// ── Phase 0 요금 상수 ──

export const STUDIO_PRICING = {
  creditPriceKrw: 1000,
  // Legacy 단일가 (하위 호환용, 새 UI는 티어 기반 사용)
  costPerCover: 5,
  costPerSceneRegen: 1,
  signupBonus: 5, // 첫 MV 1회 무료
} as const;

// ── 티어별 스펙 (백엔드 runware_catalog.TIERS와 동기화 필수) ──
// 2026-04-18: 마스터 지시로 3티어 도입. 기존 5크레딧 단일가 → tier 기반 가격 전환.

export interface StudioTierSpec {
  tier: QualityTier;
  credits: number;           // 크레딧 차감량
  priceKrw: number;          // 유저 결제가 (크레딧 × 1000원)
  durationSec: number;       // MV 길이
  sceneCount: number;        // 씬 수
  budgetUsd: number;         // API 원가 상한 (초과 시 auto-refund)
  modelLabel: string;        // "Seedream 5.0 + Kling 3.0 Pro" 같은 요약
  imageResolution: string;   // "2048x1152" 등 표시용
  tagline: string;           // 유저 노출 한 줄 설명
  recommended?: boolean;     // '추천' 배지 (Pro)
}

// ⚠️ 동기화 필수 — 이 상수를 수정하면 반드시 아래 2곳을 함께 갱신할 것:
//   1) backend/infra/runware_catalog.py TIERS
//   2) supabase/migrations/*_studio_quality_tiers.sql (studio_tier_catalog 뷰)
// 불일치 사례: FAILURES.md #2 (해상도 동기화 누락)
export const STUDIO_TIERS: Record<QualityTier, StudioTierSpec> = {
  draft: {
    tier: 'draft',
    credits: 3,
    priceKrw: 3_000,
    durationSec: 15,
    sceneCount: 3,
    budgetUsd: 2.0,
    modelLabel: 'FLUX Schnell + Wan 2.2',
    imageResolution: '1024×576',
    tagline: '빠른 체험용 15초 — 처음이면 여기서',
  },
  pro: {
    tier: 'pro',
    credits: 15,
    priceKrw: 15_000,
    durationSec: 30,
    sceneCount: 5,
    budgetUsd: 7.0,
    modelLabel: 'Seedream 4.5 + Kling 2.6 Pro',
    imageResolution: '2560×1440',   // QHD, Seedream 4.5 픽셀 하한 통과 (FAILURES #1)
    tagline: '표준 30초 — SNS 업로드에 최적',
    recommended: true,
  },
  studio: {
    tier: 'studio',
    credits: 40,
    priceKrw: 40_000,
    durationSec: 60,
    sceneCount: 8,
    budgetUsd: 18.0,
    modelLabel: 'Seedream 5.0 Lite + Kling 3.0 Pro',
    imageResolution: '2880×1620',   // 3K, Seedream 5.0 Lite 여유 통과 (FAILURES #1)
    tagline: '프리미엄 60초 — 브랜드·인플루언서용 풀 MV',
  },
} as const;

export const DEFAULT_STUDIO_TIER: QualityTier = 'pro';

export const STUDIO_TIER_ORDER: readonly QualityTier[] = ['draft', 'pro', 'studio'];

export function studioTier(tier: QualityTier): StudioTierSpec {
  return STUDIO_TIERS[tier];
}

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
