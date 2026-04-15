# HLB 보컬스튜디오 — UI 전체 리디자인 스펙

## 개요

기존 CSS Modules 102개 + 커스텀 디자인 시스템을 **shadcn/ui + Magic UI + Tailwind v4** 기반으로 전면 교체.
다크/라이트 양쪽 지원, "딥 포레스트 그린 + 3D 깊이감 + 발광 효과" 디자인 언어.

**프리뷰 확인 완료**: `/design-preview` 페이지에서 사용자 승인.

## 확정된 디자인 방향

| 항목 | 결정 |
|------|------|
| 범위 | 전체 리디자인 (모든 페이지) |
| UI 스택 | shadcn/ui + Magic UI + Tailwind v4 + framer-motion + lucide-react |
| 테마 | 다크/라이트 양쪽 지원 (시스템 자동 감지 + 수동 토글) |
| 톤 | 게이미피케이션 + 프리미엄 감성 하이브리드 |
| 디자인 컨셉 | "소리의 공간" — 고급 오디오 스튜디오 + 음파 시각화 |
| 기존 제약 | 보이스코리아 컨셉 해제, 10/10 목표 |

## 컬러 시스템

### 다크 모드 (Primary)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--bg-base` | `#080C0A` | 페이지 배경 |
| `--bg-card` | `rgba(255,255,255,0.015)` + gradient | 카드 배경 (글래스모피즘) |
| `--text-primary` | `#E2E6E3` | 본문/제목 |
| `--text-secondary` | `#7A8A80` | 부제/설명 |
| `--text-muted` | `#4A5A50` | 라벨/캡션 |
| `--text-dim` | `#3A4A40` | 비활성/최소 |
| `--accent` | `#5B8C6E` | 메인 악센트 (딥 포레스트 그린) |
| `--accent-light` | `#6EAA80` | 밝은 악센트 (텍스트/아이콘) |
| `--accent-bright` | `#8CC6A0` | 그라데이션 끝점 / 발광 |
| `--accent-glow` | `rgba(80,180,120,0.25)` | 버튼/카드 외부 발광 |
| `--border` | `rgba(255,255,255,0.06)` | 기본 테두리 |
| `--border-hover` | `rgba(255,255,255,0.10)` | 호버 테두리 |

### 라이트 모드

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--bg-base` | `#F6F8F7` | 페이지 배경 |
| `--bg-card` | `#FFFFFF` | 카드 배경 |
| `--text-primary` | `#1A2420` | 본문/제목 |
| `--text-secondary` | `#5A6A60` | 부제/설명 |
| `--text-muted` | `#8A9A90` | 라벨/캡션 |
| `--accent` | `#4A7A5D` | 메인 악센트 (더 진한 그린) |
| `--accent-light` | `#5B8C6E` | 밝은 악센트 |
| `--border` | `rgba(0,0,0,0.08)` | 기본 테두리 |

### 시맨틱 컬러 (양쪽 공통)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--success` | `#10B981` | 통과/완료 |
| `--warning` | `#F59E0B` | 경고/주의 |
| `--error` | `#F43F5E` | 실패/에러 |
| `--streak-gold` | `#FBBF24` | 스트릭 축하 |

## 타이포그래피

| 용도 | 폰트 | Weight |
|------|------|--------|
| 디스플레이/제목 | Crimson Pro + Noto Serif KR | 300 (light), 400 (normal) |
| 본문/UI | Inter + Noto Sans KR | 400, 500, 600 |
| 코드/숫자 | JetBrains Mono | 400, 500 |

## 3D 깊이감 시스템

### GlowCard 컴포넌트
- `bg-gradient-to-b from-white/[0.03] to-white/[0.01]` + `backdrop-blur-sm`
- 외부 깊이 그림자 + 내부 상단 하이라이트
- 활성 카드: 상단 1px 그린 그라데이션 라인 + 외부 녹색 발광
- 진입 애니메이션: `rotateX: 5 → 0`

### 발광 효과
- 텍스트 `textShadow`, 라벨 `drop-shadow`, 프로그레스 `boxShadow`
- CTA 버튼 외부 60px glow
- 배경 3개의 녹색 blur 오브

### 음파 배경 (Canvas)
- 6개 사인파, 초록색, `shadowBlur`로 발광
- `requestAnimationFrame` 느린 움직임

## 컴포넌트 교체

| 기존 | 신규 |
|------|------|
| `ds/Button` | `ui/button` + glow variant |
| `ds/Card` | `ui/card` + GlowCard |
| `ds/NavBar` | 커스텀 Nav (sticky + blur + 발광) |
| `ds/MetricBar` | framer-motion 바 |
| `ds/ScoreDisplay` | SVG 링 + motion.circle |

### 추가 패키지
- `next-themes` (다크/라이트)
- Magic UI 컴포넌트 (copy)

### CSS Modules 102개 마이그레이션 순서
1. 공통 (`ds/`, `shared/`)
2. 랜딩 → 대시보드 → 여정 → 레슨 → 나머지

## 페이지별 요약

1. **랜딩**: Hero + 음파 Canvas + Social proof + How it works + 요금제 + CTA
2. **대시보드**: 스트릭/점수/긴장 3컬럼 + 연습 추천 + 성장 그래프
3. **소리의 길**: 28단계 GlowCard 그리드, 진행중만 발광
4. **레슨**: 5-Phase 탭 + 실시간 시각화 + 피드백 패널
5. **온보딩**: 녹음→분석→결과→로드맵 위저드
6. **AI 코치**: 채팅 버블 + 퀵 칩
7. **기타**: 동일 디자인 언어 적용

## 완료 기준

1. 모든 페이지 신규 디자인 시스템으로 교체
2. 다크/라이트 양쪽 정상 동작
3. `.module.css` 102개 전부 삭제
4. `npm run build` 에러 없음
5. 모바일(375px)~데스크톱(1440px) 반응형
6. 기존 기능 회귀 없음
