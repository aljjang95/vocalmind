# HLB 보컬스튜디오

Next.js 14 + Python FastAPI 보컬 트레이닝 AI 웹앱.
parselmouth 4축 긴장 감지 + Claude Haiku 감각 코칭 + edge-tts 음성 합성.

## Quick Start

```bash
cd vocalmind_2/vocalmind

# 프론트 + 백엔드 동시 실행 (권장)
bash scripts/dev.sh    # Next.js :3010 + FastAPI :8001

# 프론트엔드만
npm install && npm run dev

# 백엔드만
cd backend && uv run uvicorn main:app --port 8001 --reload

# 테스트
npm run build                              # 프론트엔드 빌드
cd backend && python -m pytest tests/ -v   # 백엔드 124개 테스트
```

## Tech Stack

```
Frontend: Next.js 14 | React 18 | TypeScript (strict) | Zustand | Tailwind | CSS Modules
Backend:  Python 3.12 | FastAPI | parselmouth (Praat) | ChromaDB | soundfile | edge-tts
AI:       Anthropic Claude Haiku (코칭/상담/리포트) | parselmouth (긴장 감지) | ChromaDB (RAG)
Audio:    Tone.js (피아노) | react-piano | soundfont-player | pitchy (피치 감지) | MediaRecorder
Infra:    Supabase (Auth + DB + Storage + SSR) | server-only
```

## Architecture

```
vocalmind_2/vocalmind/
├── app/
│   ├── auth/
│   │   ├── login/             # 로그인 (이메일/비밀번호)
│   │   ├── signup/            # 회원가입 (이름/이메일/비밀번호)
│   │   └── callback/          # OAuth/이메일 인증 콜백
│   ├── (marketing)/           # 공개 랜딩 페이지 (Hero+Features+Pricing+CTA)
│   ├── onboarding/            # 상담 (녹음→4축분석→AI로드맵→TTS→레슨연결)
│   ├── dashboard/             # 대시보드 (진도카드+오늘연습+성장그래프)
│   ├── journey/               # 소리의 길 (28단계 커리큘럼 목록)
│   │   └── [stageId]/         # 5-phase 레슨 (왜?→시범→실습→평가→요약)
│   ├── scale-practice/        # 스케일 연습 (자동레슨+자유연습)
│   │   └── [stageId]/         # 단계별 스케일 연습 공간
│   ├── coach/                 # AI 코치 (채팅 인터페이스)
│   ├── coaching/              # 코칭 통합 (커리큘럼트리+세션)
│   ├── practice/              # 곡 연습 (분리+구간반복+피치비교)
│   ├── breathing/             # 호흡 트레이너 (장호흡/리듬/프레이즈)
│   ├── warmup/                # AI 워밍업 루틴 생성
│   ├── diagnosis/             # 보컬 진단 (4단계 위저드)
│   ├── ai-cover/              # AI 커버곡 (RVC 학습+변환)
│   ├── pricing/               # 요금제 페이지 (4카드)
│   ├── hobby/                 # 취미반 (자유 곡 녹음+AI 평가+UpsellBanner)
│   ├── feedback-request/      # 유료 피드백 신청 (녹음+고민 제출)
│   ├── vocal-dna/             # 음색 DNA 카드 (Canvas 별자리 + 공유)
│   ├── avatar/                # 아바타 에디터 + 의상 상점
│   ├── community/             # 커뮤니티 피드 (커버/배틀/자유 + 투표)
│   │   └── [postId]/          # 게시글 상세
│   ├── audition/              # 주간 오디션 (참가 + 투표 + 리더보드)
│   ├── checkout/[plan]/       # 토스페이먼츠 결제 위젯 (구독+아이템)
│   ├── payment/success/       # 결제 성공 처리
│   ├── payment/fail/          # 결제 실패 안내
│   ├── teacher/               # 선생님 대시보드 (피드백 요청 관리)
│   ├── vocal-report/          # 주간 보컬 리포트
│   └── api/
│       ├── evaluate/          # → Python :8001/evaluate (음성 채점)
│       ├── onboarding-analyze/ # → Python :8001/onboarding/analyze (4축 분석)
│       ├── tts/               # → Python :8001/onboarding/tts (TTS 통합)
│       ├── feedback-request/  # Supabase 저장 (피드백 신청)
│       ├── journey-coach/     # → Python :8001/coach (RAG 피드백 + 참고영상)
│       ├── demo-audio/        # 시범 오디오 업로드/조회 (선생님 전용)
│       ├── chat/              # Anthropic 프록시
│       ├── warmup/            # 워밍업 루틴 생성
│       ├── diagnose/          # 보컬 진단
│       ├── coach-feedback/    # 코칭 피드백
│       ├── ai-cover/          # train, convert, status
│       ├── analyze-song/      # 곡 분석
│       ├── analyze/           # 곡 분석 (기본)
│       ├── pronunciation/     # 발음 분석
│       ├── recommend-key/     # 음정 추천
│       ├── separate/          # 음성 분리
│       ├── lyrics-sync/       # 가사 싱크
│       ├── report/            # 주간 리포트
│       ├── vocal-dna/         # GET(조회) + POST(Python 프록시 → Supabase upsert)
│       ├── avatar/            # generate, items, equip, inventory
│       ├── shop/              # purchase (토스페이먼츠 아이템 결제)
│       ├── community/         # GET(피드) + POST(작성) + vote + [postId]
│       ├── audition/          # GET(이벤트) + POST(참가) + vote
│       ├── payment/           # confirm (토스 승인), plan (구독 변경)
│       ├── storage-url/       # Supabase Storage 서명 URL 생성
│       └── teacher/           # requests (피드백 요청 목록/상세)
├── backend/                   # Python FastAPI (긴장 감지 AI 엔진)
│   ├── main.py                # FastAPI 앱 + CORS + 라우터 등록
│   ├── routers/
│   │   ├── evaluate.py        # POST /evaluate + /evaluate/scale-practice
│   │   ├── onboarding.py      # POST /onboarding/analyze + /onboarding/tts
│   │   ├── ws_evaluate.py     # WS /ws/evaluate (실시간 2초 청크)
│   │   ├── ws_scale.py        # WS /ws/scale (스케일 실시간)
│   │   ├── coach.py           # POST /coach (RAG 코칭)
│   │   └── vocal_dna.py       # POST /vocal-dna/analyze (5축 DNA 분석)
│   ├── services/
│   │   ├── tension_analyzer.py    # Jitter/Shimmer/HNR/H1-H2/포먼트/성구전환
│   │   ├── tension_scorer.py      # 4축 긴장 점수 (후두/혀뿌리/턱/성구)
│   │   ├── audio_service.py       # parselmouth 음성 분석 통합
│   │   ├── audio_utils.py         # FFmpeg WAV 변환 공용 유틸
│   │   ├── scoring.py             # 피치 정확도 + 3단계 채점
│   │   ├── realtime_analyzer.py   # 실시간 청크 분석 + 감각 피드백
│   │   ├── session_report.py      # Claude Haiku 세션 종합 리포트
│   │   ├── onboarding_service.py  # Claude Haiku 상담 (문제점+로드맵+폴백)
│   │   ├── voice_feedback.py      # edge-tts 음성 합성 (ko-KR-SunHiNeural)
│   │   └── rag_service.py         # ChromaDB RAG + Claude 감각 피드백 + 참고영상
│   ├── scripts/
│   │   └── map_feedback_to_stages.py  # ChromaDB→28단계 피드백 자동 매핑
│   ├── data/
│   │   └── stage_feedback_map.json    # 매핑 결과 (1850개→28단계)
│   ├── models/tension.py      # TensionAnalysis, TensionScore Pydantic 모델
│   └── tests/                 # 167개 테스트 (커버리지 95%)
├── components/
│   ├── ds/                    # 디자인 시스템 (Button, Card, MetricBar, ScoreDisplay, NavBar)
│   ├── shared/                # Nav, Footer, Icons, TTSButton, Waveform, DemoAudioPlayer, ScrollReveal, AudioPlayer, UserProfileCard
│   ├── onboarding/            # OnboardingWizard + Step(Recording/Analyzing/Result/Roadmap/Transition)
│   ├── journey/               # StageCard, PitchVisualizer, TensionIndicator, FeedbackPanel, PitchComparisonVisualizer, YouTubePlayer
│   │   └── phases/            # WhyPhase, DemoPhase(+영상임베드), PracticePhase(+따라하기비교), EvalPhase, SummaryPhase
│   ├── dashboard/             # NextActionCard, ProgressCard, TodayPractice, GrowthChart, AuditionWidget
│   ├── coach/                 # ChatBox, ChatMessage, ChatInput, QuickChips, SessionSummary
│   ├── marketing/             # Hero, Features, HowItWorks, AIDemo, Pricing, Testimonials, CTA
│   ├── scale-practice/        # PianoKeyboard, ScalePatternEditor, AutoLessonFlow, TransportBar
│   ├── diagnosis/             # DiagnosisWizard, StepBasicInfo/Concerns/Goals/SelfEval, DiagnosisResult
│   ├── practice/              # SongList, PlayMode, PitchDisplay, LyricsPanel, SessionResult
│   ├── warmup/                # ConditionForm, RoutineView, ExercisePlayer, RoutineHistory
│   ├── breathing/             # BreathVisualizer, BreathTimer, ModeSelector, WeeklyChart
│   ├── ai-cover/              # AudioRecorder, FileDropZone, AudioPlayer
│   ├── coaching/              # CurriculumTree, SessionInfo, CoachingLayout
│   ├── vocal-dna/             # DnaCanvas, DnaCard, DnaShareButton
│   ├── avatar/                # AvatarDisplay, AvatarEditor, ItemShop, ItemCard
│   ├── community/             # FeedTabs, PostCard, PostComposer, VoteButton, RankingBoard
│   └── audition/              # AuditionBanner, AuditionTimer, AuditionEntry, AuditionLeaderboard
├── stores/
│   ├── journeyStore.ts        # 여정 진도 + 등급 접근제어 + Supabase 동기화
│   ├── onboardingStore.ts     # 온보딩 위저드 상태
│   ├── coachStore.ts          # AI 코치 세션
│   ├── scalePracticeStore.ts  # 스케일 연습 UI 상태
│   ├── chatStore.ts           # 채팅 메시지 (비persist)
│   ├── warmupStore.ts         # 워밍업 루틴
│   ├── practiceStore.ts       # 곡 연습
│   ├── breathingStore.ts      # 호흡 세션
│   ├── diagnosisStore.ts      # 진단 위저드 (결과만 persist)
│   ├── aiCoverStore.ts        # AI 커버 모델
│   ├── coachingStore.ts       # 코칭 세션
│   ├── billingStore.ts        # 요금제 플랜 관리
│   ├── vocalDnaStore.ts       # 음색 DNA 5축 분석 결과
│   ├── avatarStore.ts         # 아바타 + 인벤토리 + 장착 상태
│   ├── communityStore.ts      # 커뮤니티 피드 (비persist)
│   └── auditionStore.ts       # 오디션 이벤트/참가/투표 (비persist)
├── lib/
│   ├── anthropic.ts           # Anthropic 클라이언트 (server-only)
│   ├── supabase/              # Supabase 서버/클라이언트
│   ├── hooks/                 # useRealtimeEval, useTTS, useAudioPlayer, usePitchDetection, useScaleWebSocket, useDemoPitch, useYouTubePlayer
│   ├── prompts/               # AI 시스템 프롬프트 (코칭/진단/채팅)
│   ├── data/hlbCurriculum.ts  # 8블록 28단계 + whyText + demoScript + 채점기준 + demoAudio/Video 자동 주입
│   ├── data/stageDemoAudio.ts # 28단계 시범 오디오 CDN URL (Supabase vocal-clips)
│   ├── data/stageDemoVideo.ts # 23단계 시범 영상 (YouTube 12편 구간 매핑)
│   ├── data/faqDatabase.ts    # 13개 FAQ 자동 응답
│   ├── audio/                 # 피치/호흡/멜로디 추출
│   └── coach/                 # 피치 채점
├── types/index.ts             # 전체 타입 (JourneyLessonPhase, OnboardingResult 등)
├── middleware.ts              # CSP nonce + Auth 라우트 보호
└── scripts/dev.sh             # 프론트+백엔드 동시 실행
```

## Module Contracts

```
Frontend → Backend (Python FastAPI :8001):
  /api/evaluate → POST /evaluate:
    multipart { audio, stage_id, target_pitches }
    → { score, pitch_accuracy, tone_stability, tension_detected, tension, feedback, passed }

  /api/onboarding-analyze → POST /onboarding/analyze:
    multipart { audio }
    → { tension: {overall, laryngeal, tongue_root, jaw, register_break, detail},
        consultation: {problems[], roadmap[], suggested_stage_id, summary} }

  /api/tts → POST /onboarding/tts:
    JSON { text }
    → audio/mpeg 바이너리

  WebSocket /ws/evaluate:
    ← binary(WebM 청크) | text({"type":"start/end"})
    → {"type":"analysis", tension: TensionData, feedback}
    → {"type":"report", summary, improvements, focus_area, exercise, encouragement, stats}

  /api/journey-coach → POST /coach:
    { stage_id, user_message, score, pitch_accuracy, tension_detail,
      jitter?, shimmer?, hnr_db?, avg_pitch_hz? }
    → { feedback, next_exercise, encouragement, references?: [{videoId, timestamp}] }
    (vocal_curriculum + vocal_feedback 이중 ChromaDB 검색 + 참고영상 메타데이터)

Frontend API (Next.js):
  /api/chat:             { messages } → { reply }
  /api/warmup:           { condition, voiceType } → WarmupRoutine
  /api/diagnose:         DiagnosisRequest → DiagnosisResult
  /api/coach-feedback:   FeedbackRequest → CoachFeedback
  /api/feedback-request: FormData(audio, concern) → Supabase 저장

  /api/vocal-dna → GET: Supabase vocal_dna 조회 / POST → Python :8001/vocal-dna/analyze → upsert
  /api/avatar/generate → POST: OpenAI GPT Image → Supabase Storage avatars/
  /api/avatar/items → GET: shop_items 목록
  /api/avatar/equip → POST: user_equipped upsert (인벤토리 소유 확인)
  /api/shop/purchase → POST: 토스 승인 → item_purchases + user_inventory
  /api/community → GET: 피드(latest/popular/battle, cursor) / POST: 게시글 작성
  /api/community/vote → POST/DELETE: 투표 (unique constraint)
  /api/audition → GET: active 이벤트 / POST: 참가 (1인 1참가)
  /api/audition/vote → POST/DELETE: 투표 (자기 투표 방지)
```

## Zustand Stores

| Store | Persist | 용도 |
|-------|---------|------|
| journeyStore | O (+ Supabase sync) | 여정 진도, 등급별 접근제어, 채점결과 |
| onboardingStore | O (result만) | 상담 위저드 상태, 분석 결과 |
| coachStore | O | AI 코치 세션 히스토리 |
| scalePracticeStore | O | 스케일 연습 UI 상태 |
| chatStore | X | 채팅 메시지 (세션 수명) |
| warmupStore | O | 워밍업 루틴, 완료 기록 |
| practiceStore | O | 곡 목록, 재생 제어 |
| breathingStore | O | 호흡 세션 기록 |
| diagnosisStore | O (result만) | 진단 위저드, 결과 |
| aiCoverStore | O | AI 커버 모델 학습 상태 |
| coachingStore | O | 코칭 세션 |
| billingStore | X | 요금제 플랜 관리 |
| vocalDnaStore | O (dna만) | 음색 DNA 5축 분석 결과 |
| avatarStore | O (avatar, equipped) | 아바타 + 인벤토리 + 장착 |
| communityStore | X | 커뮤니티 피드, 탭, cursor |
| auditionStore | X | 오디션 이벤트, 참가, 투표 |

## 긴장 감지 AI 엔진 (backend/)

parselmouth 기반으로 혀뿌리/턱/후두 긴장을 음성 신호에서 측정.

| 부위 | 음성 변화 | 파라미터 |
|-----|---------|---------|
| 혀뿌리 | F1↑, F2↓ | 포먼트 트래킹 |
| 턱 | 모음공간 축소 | VSA |
| 후두 | Jitter↑, Shimmer↑, HNR↓ | Jitter/Shimmer/HNR/H1-H2 |
| 성구전환 | 피치 급변, 무성구간 | F0 연속성, smoothness_score |

종합 긴장 점수(0~100) → tension_detected(>40) → 부위별 감각 피드백 생성.

## 5-Phase 레슨 흐름

```
[1] 왜? (Why)     — whyText + TTS/시범오디오 재생 + observationQuestion
[2] 시범 (Demo)    — YouTube 영상 구간 재생 + 시범 오디오 + TTS 폴백
[3] 실습 (Practice) — WebSocket 실시간 분석 + 따라하기 비교 모드(선생님 피치 오버레이, 세미톤 자동 보정) + LiveFeedbackToast
[4] 평가 (Eval)    — submitEvaluation + SessionReportPanel
[5] 요약 (Summary) — passed→다음레슨 / failed→재시도
```

## 요금제 구조

| 플랜 | 가격 | 범위 | AI 커버 |
|------|------|------|---------|
| 무료 | 0원 (광고) | 상담 1회 + 3단계 체험 + 내장 변환 | 내장 파일만 |
| 취미반 | 100,000원/월 | 자유 곡 실시간 평가 + AI 피드백 + 5단계 맛보기 | 5,000원/월 |
| 발성전문반 | 150,000원/월 | 28단계 HLB 커리큘럼 + 4축 분석 + 성장 리포트 | 10,000원/월 |
| 유료 피드백 | 50,000원/회 | 선생님 직접 듣고 진단 | — |

## Code Style

- 서버 컴포넌트 기본, 클라이언트는 `'use client'` 명시
- 페이지: `page.tsx`(서버) → `*Client.tsx`(클라이언트) 분리 패턴
- Store: `export const useXxxStore = create()(persist(...))`
- 타입: `types/index.ts`에 집중
- 파일명: 컴포넌트 PascalCase, 유틸 camelCase, 폴더 kebab-case
- 에러 응답: `{ error: string, code: string }` 통일
- Python: 타입 힌트 필수, `from __future__ import annotations`, soundfile.read (librosa 금지)
- CSS: CSS Modules (.module.css) + globals.css 변수 (--bg-base, --text-primary 등)

## Anti-patterns

- ❌ 클라이언트에서 `lib/supabase/server` import → server-only 위반
- ❌ `NEXT_PUBLIC_ANTHROPIC_API_KEY` → 키 노출 절대 금지
- ❌ `body.userId` 신뢰 → `supabase.auth.getUser()` 사용
- ❌ `as any` 타입 캐스팅 → strict 모드
- ❌ `librosa.load()` → Windows parselmouth 데드락. `soundfile.read()` 사용 (예외: audio_postprocess.py에서 RMS/리샘플링용 librosa 사용은 허용)
- ❌ `tension_detected = False` 고정 → TensionAnalyzer 실제 측정 사용
- ❌ Claude 호출 시 cache_control 누락 → `{"type": "ephemeral"}` 필수

## Gotchas

- 프로젝트 루트: `vocalmind_2/vocalmind/` (2단계 중첩)
- Rate Limit: 인메모리 Map → Vercel 서버리스에서 인스턴스마다 초기화
- Zustand persist + SSR → hydration 미스매치 가능 (DashboardClient에서 처리 패턴 참고)
- `parseAIResponse()` JSON 실패 시 null 반환
- middleware.ts CSP nonce → script 추가 시 nonce 전달 필수
- TensionAnalysis의 `register_transition` 필드명 (Pydantic `register` 충돌 회피)
- 백엔드 CHROMA_DB_PATH → `~/Desktop/보컬커리큘럼/chroma_db` 기본값 (외부 프로젝트 의존)
- ChromaDB 두 컬렉션: `vocal_curriculum`(211개) + `vocal_feedback`(1850개). build-feedback 재실행 시 기존 항목 upsert로 갱신
- useTTS 캐시: 모듈 레벨 Map, LRU max 20개, revokeObjectURL로 메모리 관리
- voice_feedback.py MAX_CHARS=200 (TTS 텍스트 길이 제한)
- requirements.txt 패키지명: `praat-parselmouth` (pip 이름) ≠ `parselmouth` (import 이름)
- next.config.js Permissions-Policy: 녹음 기능에 `microphone=(self)` 필수 (기본값 차단)


## Deployment

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| Frontend | Vercel | vocalmind-lemon.vercel.app |
| Backend | Fly.io (nrt) | vocalmind-backend.fly.dev |

- Backend CORS: `FRONTEND_URL` 환경변수로 프론트 도메인 허용
- Fly.io: shared 1CPU, 512MB, auto_stop/auto_start, min_machines=0
- Vercel: `backend/` 제외 (.vercelignore)

## Architecture Decisions

- [ADR-001](docs/adr/001-server-only-anthropic.md) — Anthropic API server-only 강제

## Environment

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # 미사용, 향후 선생님 대시보드용
ANTHROPIC_API_KEY=
VOCAL_BACKEND_URL=http://localhost:8001

# backend/.env (또는 환경변수)
CHROMA_DB_PATH=~/Desktop/보컬커리큘럼/chroma_db
ANTHROPIC_API_KEY=               # 백엔드용 (RAG 코칭 + 온보딩 상담)
FRONTEND_URL=                    # 프로덕션 CORS용 (Fly.io 환경변수로 설정)
```

## Testing

백엔드: pytest 167개 테스트 (커버리지 95%) — `cd backend && python -m pytest tests/ -v`
프론트엔드: `npm run build` 빌드 검증


