# HLB 보컬스튜디오

7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 보컬 트레이닝 플랫폼입니다.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **상태관리**: Zustand
- **스타일링**: CSS Modules + 글로벌 디자인 토큰
- **AI**: Anthropic Claude (서버 사이드 전용)
- **DB/Auth**: Supabase (Phase 2)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 `.env.example`을 참고하여 작성합니다:

```env
ANTHROPIC_API_KEY=<ANTHROPIC_API_KEY>
NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_PROJECT_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

각 키는 해당 서비스 대시보드에서 발급받으세요.

> **보안 주의**: `ANTHROPIC_API_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.  
> 서버 API Route에서만 사용되며 클라이언트에 절대 노출되지 않습니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`에서 확인하세요.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
vocalmind/
├── app/
│   ├── (marketing)/          # 랜딩 페이지 (인증 불필요)
│   │   ├── page.tsx           # 메인 랜딩
│   │   └── layout.tsx         # Nav + Footer + ScrollReveal
│   ├── (app)/                 # 인증 필요 영역 (Phase 2)
│   ├── api/
│   │   ├── chat/route.ts      # Anthropic 프록시 — API 키 서버 격리
│   │   ├── analyze/route.ts   # 음성 분석 저장 (Phase 2)
│   │   └── report/route.ts    # 성장 리포트 (Phase 2)
│   └── globals.css            # 디자인 토큰 + 전역 스타일
│
├── components/
│   ├── coach/                 # AI 채팅 UI
│   │   ├── ChatBox.tsx        # 채팅 컨테이너 (Zustand 연동)
│   │   ├── ChatMessage.tsx    # 메시지 버블 + 타이핑 인디케이터
│   │   ├── ChatInput.tsx      # 입력창 + 전송 버튼
│   │   └── QuickChips.tsx     # 빠른 질문 칩
│   ├── marketing/             # 랜딩 섹션 컴포넌트
│   │   ├── Hero.tsx
│   │   ├── Proof.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Demo.tsx           # AI 채팅 데모 래퍼
│   │   ├── Pricing.tsx        # 월간/연간 토글
│   │   ├── Testimonials.tsx
│   │   └── CtaSection.tsx
│   └── shared/
│       ├── Nav.tsx            # 스크롤 감지 네비게이션
│       ├── Footer.tsx
│       ├── Waveform.tsx       # 파형 애니메이션 컴포넌트
│       └── ScrollReveal.tsx   # IntersectionObserver reveal
│
├── lib/
│   ├── anthropic.ts           # Anthropic 클라이언트 (server-only)
│   ├── prompts/vocal-coach.ts # 시스템 프롬프트 단일 소스
│   └── supabase/
│       ├── client.ts          # 클라이언트 사이드 Supabase
│       └── server.ts          # 서버 사이드 Supabase (server-only)
│
├── stores/
│   ├── chatStore.ts           # Zustand: 채팅 상태
│   └── billingStore.ts        # Zustand: 요금제 토글
│
└── types/index.ts             # 공통 TypeScript 타입
```

## 핵심 설계 결정

### API 키 서버 격리 (보안)
- Anthropic API 호출은 `app/api/chat/route.ts`에서만 실행
- 클라이언트는 `/api/chat`으로 POST 요청만 보내고 서버가 중계
- `lib/anthropic.ts`에 `'server-only'` 선언으로 클라이언트 번들 포함 차단

### Phase 1 / Phase 2 구분
- **Phase 1 (현재)**: 랜딩 페이지 + AI 채팅 데모 완전 작동
- **Phase 2 (예정)**: Web Audio API 실시간 분석, Supabase 인증/저장, 대시보드

## Vercel 배포

```bash
vercel --prod
```

환경변수는 Vercel 대시보드 → Settings → Environment Variables에서 설정하세요.
