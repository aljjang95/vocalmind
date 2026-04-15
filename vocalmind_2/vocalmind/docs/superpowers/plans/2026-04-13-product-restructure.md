# HLB 보컬스튜디오 제품 구조 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정액제 삭제, 취미반(10만) 신설, 온보딩 강화(파일 업로드+요금제 분기), AI 커버 티어별 제한, 이메일 인증 버그 수정

**Architecture:** 기존 Next.js 14 + FastAPI 구조 유지. billingStore/journeyStore의 티어 체계를 hobby=취미반, pro=발성전문반으로 재정의. 온보딩 위저드에 요금제 선택 스텝 추가. AI 커버 API 사용량을 Supabase profiles JSONB로 추적.

**Tech Stack:** Next.js 14, TypeScript, Zustand, Tailwind, Supabase, FastAPI, Anthropic Haiku

---

## Task 1: 이메일 인증 버그 수정

**Files:**
- Modify: `middleware.ts`
- Create: `app/auth/verify-email/page.tsx`

- [ ] **Step 1: middleware에 이메일 인증 체크 추가**

`middleware.ts`에서 `user` 가져온 직후, 인증 안 된 사용자를 별도 페이지로 리다이렉트:

```typescript
// 기존 코드 아래에 추가 (line ~59 이후)
const { data: { user } } = await supabase.auth.getUser();
const pathname = request.nextUrl.pathname;

// 이메일 미인증 사용자 → 인증 안내 페이지로
if (user && !user.email_confirmed_at && !pathname.startsWith('/auth/')) {
  return NextResponse.redirect(new URL('/auth/verify-email', request.url));
}
```

- [ ] **Step 2: 이메일 인증 안내 페이지 생성**

`app/auth/verify-email/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function VerifyEmailPage() {
  const handleResend = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
      alert('인증 메일을 다시 보냈습니다.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-6">
      <div className="text-center max-w-[440px]">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2">
            <path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"/>
            <path d="M2 13l10 8 10-8"/>
          </svg>
        </div>
        <h2 className="text-[var(--text-primary)] text-2xl font-bold mb-3">이메일 인증을 완료해주세요</h2>
        <p className="text-[var(--text-secondary)] text-[0.9375rem] leading-relaxed">
          가입 시 입력한 이메일로 인증 링크를 보냈습니다.<br/>
          링크를 클릭하면 서비스를 이용할 수 있습니다.
        </p>
        <div className="flex flex-col gap-3 mt-8">
          <button onClick={handleResend} className="py-3 px-8 rounded-xl bg-[var(--accent)] text-white font-medium border-none cursor-pointer">
            인증 메일 다시 보내기
          </button>
          <Link href="/auth/login" className="py-3 px-8 rounded-xl border border-white/10 text-white/70 no-underline text-sm">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add middleware.ts app/auth/verify-email/
git commit -m "fix: block unverified email users from accessing protected routes"
```

---

## Task 2: 타입 정리 + 요금제 구조 변경

**Files:**
- Modify: `types/index.ts`
- Modify: `stores/billingStore.ts`
- Modify: `stores/journeyStore.ts`

- [ ] **Step 1: types/index.ts Plan 타입 수정**

```typescript
// 기존
export type Plan = 'free' | 'basic' | 'pro';
// 변경
export type Plan = 'free' | 'hobby' | 'pro';
```

- [ ] **Step 2: billingStore 전면 수정**

`stores/billingStore.ts` — 정액제(`subscription`) 삭제, `hobby` = 취미반으로 재정의:

```typescript
'use client';

import { create } from 'zustand';
import type { Plan } from '@/types';

interface BillingState {
  plan: Plan;
  apiUsageWon: number;      // 이번 달 API 사용액 (원)
  apiResetDate: string;     // 월 리셋일 (ISO)
  setPlan: (plan: Plan) => void;
  addApiUsage: (won: number) => void;
  canUseApi: () => boolean;
  getApiLimit: () => number;
  showAds: () => boolean;
  canAccessStage: (stageId: number) => boolean;
  canUploadOwnSong: () => boolean;
  syncFromServer: () => Promise<void>;
}

export const useBillingStore = create<BillingState>()((set, get) => ({
  plan: 'free' as Plan,
  apiUsageWon: 0,
  apiResetDate: '',

  setPlan: (plan) => set({ plan }),

  addApiUsage: (won) => set((s) => ({ apiUsageWon: s.apiUsageWon + won })),

  getApiLimit: () => {
    const { plan } = get();
    if (plan === 'hobby') return 5000;   // 취미반: 5,000원/월
    if (plan === 'pro') return 10000;    // 발성전문반: 10,000원/월
    return 0;                            // 무료: API 사용 불가
  },

  canUseApi: () => {
    const { apiUsageWon } = get();
    const limit = get().getApiLimit();
    return limit > 0 && apiUsageWon < limit;
  },

  showAds: () => get().plan === 'free',

  canAccessStage: (stageId) => {
    const { plan } = get();
    if (stageId <= 3) return true;              // 맛보기 3단계 무료
    if (plan === 'hobby') return stageId <= 5;  // 취미반: 맛보기 5단계
    if (plan === 'pro') return true;            // 발성전문반: 전체
    return false;                               // 무료: 3단계만
  },

  canUploadOwnSong: () => get().plan !== 'free',

  syncFromServer: async () => {
    try {
      const res = await fetch('/api/payment/plan');
      if (res.ok) {
        const data = await res.json();
        set({
          plan: data.plan ?? 'free',
          apiUsageWon: data.apiUsageWon ?? 0,
          apiResetDate: data.apiResetDate ?? '',
        });
      }
    } catch {
      // 무시
    }
  },
}));
```

- [ ] **Step 3: journeyStore에서 canAccessTier 업데이트**

`stores/journeyStore.ts` — `hobby` 티어가 제한적 접근으로 변경:

```typescript
// 기존 canAccessTier 함수 수정
function canAccessTier(userTier: UserTier, minTier: UserTier): boolean {
  const tierOrder: UserTier[] = ['free', 'hobby', 'pro', 'teacher'];
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(minTier);
}
```

(기존과 동일 — 순서만 확인. hobby < pro < teacher 유지.)

- [ ] **Step 4: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add types/index.ts stores/billingStore.ts stores/journeyStore.ts
git commit -m "refactor: restructure billing tiers — remove subscription, add hobby(취미반)"
```

---

## Task 3: Pricing 컴포넌트 리빌드

**Files:**
- Modify: `components/marketing/Pricing.tsx`
- Modify: `app/checkout/[plan]/CheckoutClient.tsx`

- [ ] **Step 1: Pricing.tsx — 3카드 + 유료피드백으로 변경**

정액제 카드 삭제. 무료(0원) / 취미반(10만) / 발성전문반(15만, 추천) / 유료피드백(5만).

무료 카드의 버튼 → `/onboarding`, 취미반 → `/checkout/hobby`, 발성전문반 → `/checkout/pro`, 피드백 → `/checkout/feedback`.

취미반 카드 Feature 목록:
- 자유 곡 실시간 평가 + AI 피드백
- HLB 커리큘럼 맛보기 (5단계)
- AI 보컬 지식 종합 코칭
- AI 커버 (본인 파일, 5,000원/월)
- 목소리 클론

발성전문반 카드 Feature 목록:
- 취미반 전부 포함
- 28단계 HLB 체계적 커리큘럼
- 5-phase 레슨 (왜?→시범→실습→평가→요약)
- 카메라/녹음 발성 체크
- 4축 긴장 상세 분석
- 성장 리포트 + 맞춤 루틴
- AI 커버 (본인 파일, 10,000원/월)

- [ ] **Step 2: CheckoutClient.tsx — 플랜 정보 업데이트**

```typescript
const PLAN_INFO: Record<string, { name: string; price: number; desc: string }> = {
  hobby: { name: '취미반', price: 100_000, desc: '자유 곡 실시간 평가 + AI 피드백' },
  pro: { name: '발성전문반', price: 150_000, desc: '28단계 HLB 체계적 커리큘럼' },
  feedback: { name: '유료 피드백', price: 50_000, desc: '선생님 직접 듣고 진단 (1회)' },
};
```

`subscription` 키 삭제. `hobby` 추가. 유효 플랜 목록: `['hobby', 'pro', 'feedback']`.

- [ ] **Step 3: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add components/marketing/Pricing.tsx app/checkout/
git commit -m "feat: rebuild pricing — hobby(10만), pro(15만), remove subscription"
```

---

## Task 4: 온보딩 강화 — 파일 업로드 + 음질 경고

**Files:**
- Modify: `components/onboarding/StepRecording.tsx`

- [ ] **Step 1: StepRecording에 음질 경고 배너 추가**

녹음 영역 위에 경고 배너:

```tsx
<div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 text-[0.82rem] mb-5">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path d="M8 1.5l6.5 12H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8 6.5v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
  소음이 많거나 음질이 낮으면 정확한 분석이 어렵습니다. 조용한 환경에서 녹음해주세요.
</div>
```

- [ ] **Step 2: 파일 업로드 UI 개선**

기존 `input[type=file]` 영역을 드래그&드롭 + 클릭 영역으로 개선. 허용 포맷 `.mp3, .wav, .m4a, .webm`. 최대 10MB.

- [ ] **Step 3: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add components/onboarding/StepRecording.tsx
git commit -m "feat: add quality warning banner + improve file upload UX in onboarding"
```

---

## Task 5: 온보딩 요금제 선택 분기

**Files:**
- Create: `components/onboarding/StepPlanChoice.tsx`
- Modify: `components/onboarding/OnboardingWizard.tsx`
- Modify: `components/onboarding/StepTransition.tsx`
- Modify: `stores/onboardingStore.ts`

- [ ] **Step 1: StepPlanChoice 컴포넌트 생성**

상담 결과 후 보여주는 요금제 선택 화면. 3가지 선택지:
- "부르면서 자유롭게 배우고 싶어요" → 취미반 (10만/월)
- "체계적으로 처음부터 배우고 싶어요" → 발성전문반 (15만/월)
- "일단 둘러볼게요" → 무료

각 카드에 간결한 설명 + 가격 + CTA 버튼. 취미반과 발성전문반 차이를 명확히 시각화.
발성전문반에 "추천" 뱃지.

비로그인 시 → `/auth/signup?next=/dashboard&plan=hobby` 또는 `plan=pro`
로그인 시 → `/checkout/hobby` 또는 `/checkout/pro`
무료 → `/dashboard`

- [ ] **Step 2: OnboardingWizard 스텝 확장**

기존 5스텝 → 6스텝:
```
0: 녹음/업로드
1: 분석 중
2: 결과 (문제점 진단)
3: 로드맵 (교정 방향)
4: 요금제 선택 (NEW — StepPlanChoice)
5: 시작 (StepTransition — 선택한 플랜에 맞게)
```

- [ ] **Step 3: StepTransition 수정**

선택한 플랜에 따라 다른 랜딩:
- 취미반 → `/hobby` (취미반 메인 페이지)
- 발성전문반 → `/journey/{suggestedStage}`
- 무료 → `/dashboard`

- [ ] **Step 4: onboardingStore에 selectedPlan 추가**

```typescript
interface OnboardingState {
  // ... 기존 필드
  selectedPlan: Plan | null;
  setSelectedPlan: (plan: Plan) => void;
}
```

persist에 `selectedPlan` 포함.

- [ ] **Step 5: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add components/onboarding/ stores/onboardingStore.ts
git commit -m "feat: add plan choice step to onboarding wizard"
```

---

## Task 6: 취미반 메인 페이지

**Files:**
- Create: `app/hobby/page.tsx`
- Create: `app/hobby/HobbyClient.tsx`
- Create: `components/hobby/FreeSongUpload.tsx`
- Create: `components/hobby/UpsellBanner.tsx`

- [ ] **Step 1: 취미반 페이지 레이아웃**

`app/hobby/page.tsx` (서버) → `HobbyClient.tsx` (클라이언트).

레이아웃:
- Nav
- "자유 곡 연습" 헤더
- 곡 업로드/선택 영역
- 녹음 + 실시간 평가 (기존 WebSocket 활용)
- AI 피드백 패널 (HLB 커리큘럼 맛보기 + AI 보컬 지식)
- UpsellBanner ("발성전문반에서 체계적으로 배우면 더 빠르게 성장합니다")

- [ ] **Step 2: FreeSongUpload 컴포넌트**

곡 업로드 → 곡 분석 (기존 `/api/analyze-song` 활용) → 녹음 → 평가.
무료 사용자: 내장 저작권 없는 파일만 선택 가능.
취미반: 본인 파일 업로드 가능.

- [ ] **Step 3: UpsellBanner 컴포넌트**

```tsx
export default function UpsellBanner() {
  return (
    <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.03] p-5 mt-6">
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
        더 빠르게 성장하고 싶다면?
      </h4>
      <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
        발성전문반은 HLB 선생님의 체계적인 28단계 커리큘럼으로 진행됩니다.
        단계별 채점과 해금 시스템으로 확실한 실력 향상을 보장합니다.
      </p>
      <Link href="/checkout/pro" className="inline-block mt-3 text-sm text-[var(--accent-light)] font-medium no-underline hover:underline">
        발성전문반 알아보기 →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: middleware PUBLIC_PATHS에 /hobby 추가 (유료 전용이면 제거)**

취미반 전용이므로 PUBLIC_PATHS에 추가하지 않음. 로그인+결제 필요.

- [ ] **Step 5: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add app/hobby/ components/hobby/
git commit -m "feat: add hobby class main page with free song evaluation"
```

---

## Task 7: AI 커버 티어별 제한

**Files:**
- Modify: `stores/aiCoverStore.ts`
- Modify: `app/ai-cover/` 관련 컴포넌트
- Create: `supabase/migrations/20260413_api_usage.sql`

- [ ] **Step 1: Supabase 마이그레이션 — profiles에 api_usage 추가**

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS api_usage_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS api_usage_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN profiles.api_usage_won IS '이번 달 API 사용액 (원)';
COMMENT ON COLUMN profiles.api_usage_reset_at IS 'API 사용량 월 리셋 시점';
```

- [ ] **Step 2: aiCoverStore에 티어별 제한 로직 추가**

무료: 내장 파일만 (업로드 불가)
취미반: 본인 파일 업로드 가능, 5,000원/월
발성전문반: 본인 파일 업로드 가능, 10,000원/월

billingStore의 `canUseApi()`, `canUploadOwnSong()` 활용.

- [ ] **Step 3: AI 커버 UI에 사용량 표시 + 제한 안내**

상단에 "이번 달 사용량: 2,300원 / 5,000원" 프로그레스 바.
한도 초과 시 "이번 달 사용량을 모두 소진했습니다. 다음 달에 리셋됩니다." 안내.

- [ ] **Step 4: 빌드 검증 + 커밋**

Run: `npm run build`

```bash
git add stores/aiCoverStore.ts app/ai-cover/ supabase/migrations/
git commit -m "feat: add tier-based API usage limits for AI cover"
```

---

## Task 8: 리서치 + awesome-design으로 온보딩 UX 감동 설계

**Files:**
- 온보딩 관련 전체 컴포넌트

- [ ] **Step 1: 최신 트렌드 리서치**

WebSearch로 "best onboarding UX 2026", "vocal training app UX", "music education app design" 검색.
context7으로 최신 라이브러리/디자인 패턴 확인.

- [ ] **Step 2: /awesome-design 실행**

온보딩 상담 페이지에 프리미엄 UX 적용:
- 진단 결과 시각화 (4축 레이더 차트, 파형 애니메이션)
- 단계 전환 마이크로 인터랙션
- 결과 카드 프리미엄 느낌
- "가입하고 싶다" 감정을 유도하는 UX 흐름

- [ ] **Step 3: DESIGN.md 기반 구현**

awesome-design이 생성한 DESIGN.md를 기반으로 온보딩 컴포넌트 스타일링 적용.

- [ ] **Step 4: 빌드 검증 + 커밋**

```bash
git add components/onboarding/ app/onboarding/
git commit -m "feat: premium onboarding UX with awesome-design"
```

---

## Task 9: Nav/CLAUDE.md/plan.md 동기화

**Files:**
- Modify: `components/shared/Nav.tsx`
- Modify: `CLAUDE.md` (프로젝트 루트)
- Modify: `plan.md`

- [ ] **Step 1: Nav에 취미반 링크 추가**

hobby 티어 사용자에게 "/hobby" (자유 연습) 메뉴 노출.

- [ ] **Step 2: CLAUDE.md Architecture/요금제/Store 섹션 업데이트**

새 요금 구조, 취미반 페이지, API 사용량 추적 반영.

- [ ] **Step 3: plan.md Phase 10 추가**

Phase 10: 제품 구조 개편 (Step 37~45) 기록.

- [ ] **Step 4: 커밋**

```bash
git add components/shared/Nav.tsx CLAUDE.md plan.md
git commit -m "docs: sync Nav, CLAUDE.md, plan.md with product restructure"
```

---

## Task 10: 통합 검증

- [ ] **Step 1: 프론트엔드 빌드**

Run: `npm run build`
Expected: 성공, 0 에러

- [ ] **Step 2: 백엔드 테스트**

Run: `cd backend && python -m pytest tests/ -v`
Expected: 120개 PASS

- [ ] **Step 3: 브라우저 검증 (Playwright)**

- 랜딩 → 무료 상담 CTA → 온보딩 진입 확인
- 온보딩: 녹음 + 파일 업로드 + 음질 경고 표시
- 온보딩 결과 → 요금제 선택 분기
- Pricing 3카드 (무료/취미반/발성전문반) + 유료 피드백
- 소리의 길 (발성전문반 흐름) 정상 동작

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete product restructure — hobby class + enhanced onboarding"
```

---

## 실행 순서 요약

```
Task 1 (버그 수정) ─────────────────────────┐
Task 2 (타입/스토어) ──── Task 3 (Pricing) ──┤
Task 4 (온보딩 녹음) ──── Task 5 (플랜 선택) ─┤── Task 8 (디자인)
Task 6 (취미반 페이지) ────────────────────────┤
Task 7 (AI 커버 제한) ─────────────────────────┤
Task 9 (문서 동기화) ──────────────────────────┤
Task 10 (통합 검증) ───────────────────────────┘
```

Task 1, 2는 독립적으로 병렬 가능. Task 3은 Task 2 의존. Task 5는 Task 4 의존. Task 8은 Task 4, 5 이후. 나머지 병렬 가능.
