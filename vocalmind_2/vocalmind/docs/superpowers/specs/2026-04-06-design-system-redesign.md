# HLB 보컬스튜디오 — 디자인 시스템 + 핵심 페이지 리디자인

## 배경

보컬마인드(VocalMind)를 **HLB 보컬스튜디오**로 리브랜딩하고, 전체 UI를 프로덕션급으로 재설계한다. 현재 UI는 기능적이지만 "돈 주고 쓰고 싶은" 느낌이 부족하다.

## 목표

1. 브랜드명을 **HLB 보컬스튜디오**로 변경
2. 디자인 시스템(토큰 + 공용 컴포넌트) 구축
3. 핵심 3페이지에 적용: 랜딩 → 스케일연습 → 여정
4. 실사 배경 + 인터랙션 효과로 고품격 느낌

## 벤치마크 근거

- **ThemeForest 탑셀러**: 면 높이(elevation) 기반 카드, 여백 40% 증가, 단일 액센트
- **Dribbble/Behance 뮤직앱**: 점수 카운트업 애니메이션, 단계 진행 타임라인, 원형 게이지
- **고전환율 SaaS** (Linear, Vercel, Stripe, Spotify): 흰 CTA 버튼, 모노스페이스 숫자, 기능적 애니메이션만

## 디자인 원칙

1. 한 색만 쓴다 — 액센트 블루 #3B82F6, 보라는 축하 그라데이션에만
2. 면 높이로 구분 — 테두리 대신 배경색 단계 (#09090B → #111113 → #1A1A1E)
3. CTA 버튼은 흰색 — 다크 배경에 최대 대비
4. 점수는 모노스페이스 — JetBrains Mono로 정밀 측정 도구 느낌
5. 여백 40% 늘린다 — 카드 패딩 28px, 섹션 간격 96px
6. 실사 배경 — 보컬 관련 Unsplash 고화질 (스튜디오, 마이크, 피아노)
7. 기능적 애니메이션만 — 리플, 글로우 트래킹, 스크롤 리빌, 카운트업
8. 이모지 금지 — SVG 아이콘 또는 텍스트만

## 1. 디자인 토큰

### 배경 (Zinc Elevation)
| 토큰 | 값 | 용도 |
|------|------|------|
| --bg-base | #09090B | 페이지 배경 |
| --bg-raised | #111113 | 카드, 패널 |
| --bg-elevated | #1A1A1E | 모달, 활성 카드 |
| --bg-hover | #222226 | 호버 |

### 텍스트
| 토큰 | 값 | 용도 |
|------|------|------|
| --text-primary | #FAFAFA | 헤딩, 주 콘텐츠 |
| --text-secondary | #A1A1AA | 설명, 보조 |
| --text-muted | #63636E | 캡션, 비활성 |

### 액센트 + 시맨틱
| 토큰 | 값 | 용도 |
|------|------|------|
| --accent | #3B82F6 | 인터랙티브 요소 (버튼, 링크, 포커스) |
| --accent-hover | #2563EB | 액센트 호버 |
| --accent-muted | rgba(59,130,246,0.12) | 액센트 배경, 태그 |
| --success | #22C55E | 통과, 완료 |
| --warning | #EAB308 | 주의 |
| --error | #EF4444 | 실패, 긴장 감지 |

### 테두리
| 토큰 | 값 |
|------|------|
| --border-subtle | rgba(255,255,255,0.06) |
| --border-default | rgba(255,255,255,0.10) |
| --border-strong | rgba(255,255,255,0.16) |

### 라운딩
- 8px: 태그, 배지
- 12px: 버튼, 인풋
- 16px: 카드, 모달

### 타이포그래피
- Sans: Inter + Noto Sans KR
- Mono: JetBrains Mono (점수, 피치값)
- Display: 800wt, -0.03em, 1.05lh
- H1: 700wt, -0.025em, 1.1lh
- H2: 650wt, -0.02em, 1.2lh
- Body: 400wt, 1.7lh
- Caption: 500wt, 0.04em, uppercase

## 2. 공용 컴포넌트

### Button (4종)
- **Primary**: bg #FAFAFA, color #09090B, hover translateY(-2px) + 그림자
- **Accent**: bg #3B82F6, color #fff (시작/녹음 등 핵심 액션)
- **Secondary**: bg transparent, border --border-default
- **Ghost**: bg transparent, color --text-secondary
- 공통: 클릭 시 scale(0.97) + 리플 효과, border-radius 12px

### Card (3종)
- **Default**: bg --bg-raised, border --border-subtle, 호버 시 border 밝아짐
- **Active**: 왼쪽 4px 액센트 바 + radial-gradient 글로우
- **Locked**: opacity 0.35, 자물쇠 SVG

### NavBar
- 높이 56px, 블러 배경, 5개 이하 링크
- 활성 탭: 하단 2px 액센트 바
- 로고: SVG 마이크 아이콘 + "HLB 보컬스튜디오"

### ScoreDisplay
- 원형 게이지 (SVG circle, stroke-dashoffset 애니메이션)
- JetBrains Mono 48px 숫자 + 카운트업
- 색상: <40 빨강, 40-69 노랑, 70-89 파랑, 90+ 초록

### MetricBar
- 라벨 + 모노 숫자 + 4px 바
- VU 눈금 없음 (심플)

## 3. 인터랙션 효과

### 클릭 리플
- 버튼/카드 클릭 시 흰색 반투명 원형 파동
- 0.6s ease-out, scale(0→4) + opacity(0.15→0)

### 글로우 트래킹
- 피처 카드에 마우스 위치 따라다니는 파란 radial-gradient
- CSS custom property --glow-x, --glow-y로 제어

### 스크롤 리빌
- IntersectionObserver, threshold 0.15
- opacity 0→1, translateY(24px→0), 0.7s ease-out-expo

### 점수 카운트업
- requestAnimationFrame, ease-out cubic
- 0에서 목표 점수까지 1.2초

### 호버 효과
- 카드: translateY(-4px) + 깊은 그림자
- 피처 아이콘: scale(1.1) rotate(-3deg)
- 스테이지: translateX(4px) + 화살표 등장

## 4. 실사 배경

### 사용 위치
- **히어로**: 레코딩 스튜디오 (마이크 + 콘솔)
- **여정 섹션**: 피아노 건반 클로즈업
- **CTA 섹션**: 가수 퍼포먼스

### 처리 방식
- filter: brightness(0.2~0.25) saturate(0.5~0.7)
- 위아래 그라데이션 오버레이로 콘텐츠 배경과 자연스럽게 연결
- Unsplash 고해상도 (w=1920, q=80)

## 5. 적용 범위 (핵심 3페이지)

### 5-1. 랜딩 페이지
- 히어로: 실사 배경 + 배지 + 타이틀 + CTA
- 피처 그리드: 3열 글로우 카드
- 사회적 증거 (후기/숫자)
- CTA 섹션: 실사 배경 + 무료 체험 버튼

### 5-2. 스케일 연습 (/scale-practice)
- 메인: 블록별 그룹 스테이지 리스트 (현재 구현과 동일 구조)
- 레슨 모드: 코치 도트 + 가이드 + 시작 원형 버튼 + 점수 링
- 자유 모드: 피아노 + 패턴 편집기 + 피드백 모드

### 5-3. 여정 (/journey)
- 현재 단계 강조 카드 (Active Card 적용)
- 완료/잠금 시각적 구분
- 진도 요약 상단 바

## 6. 브랜드 변경 체크리스트

- [ ] metadata.title: "HLB 보컬스튜디오"
- [ ] Nav 로고 텍스트 + SVG 마이크 아이콘
- [ ] 랜딩 페이지 모든 "VocalMind" / "보컬마인드" → "HLB 보컬스튜디오"
- [ ] og:title, description 등 메타데이터

## 7. 안티패턴 (금지)

- 이모지를 디자인 요소로 사용
- 그라데이션 버튼 (CTA 포함)
- 다크모드에서 box-shadow 남용
- 동시에 3색 이상 액센트
- 항상 움직이는 장식 애니메이션
- border-radius 불일치 (8/12/16만 사용)
- 한국어 line-height 1.5 이하

## 완료 기준

- [ ] globals.css 토큰 교체 완료
- [ ] Button/Card/NavBar/ScoreDisplay/MetricBar 공용 컴포넌트 5개
- [ ] 랜딩 페이지 리디자인 (실사 배경 + 리플 + 글로우)
- [ ] 스케일 연습 페이지 디자인 시스템 적용
- [ ] 여정 페이지 디자인 시스템 적용
- [ ] 브랜드명 전체 교체
- [ ] 빌드 성공 + 기존 76개 테스트 PASS

---
생성일: 2026-04-06
상태: 승인 대기
