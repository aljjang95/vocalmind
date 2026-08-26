# 보컬마인드 Cloudflare 연습 데스크 디자인 QA

## Direction contract

- Mode: BUILD
- Primary lane: production product UI
- Product thesis: 실제 계정의 28단계 진도와 최근 평가에서 오늘 이어갈 소리를 즉시 찾는다.
- Subject world: HLB 커리큘럼, 개인 연습 장부, 단계별 점수, 음정과 안정도 평가.
- Visual metaphor: 연습실 벽에 매일 한 칸씩 새기는 28개의 소리 표식.
- Signature: 다음 단계와 완료율을 크게 보여주고 28개 단계가 하나의 `voice ledger`로 이어지는 진도 그리드.
- Primary action: 로그인 후 실제 다음 단계, 완료 기록, 평가 피드백 확인.
- Tone: 깊고 차분한, 교정적인, 절제된.
- Emotional promise: 5초 안에 “어디까지 왔고 다음에 무엇을 해야 하는지”를 알게 한다.
- Product truth: D1에 존재하는 프로필·진도·평가만 표시하고 가짜 성장 그래프, 스트릭, 점수, 연습 시간을 만들지 않는다.
- Creative tension: 보컬 트레이너의 감각적 언어 × 숫자로 남는 연습 장부.
- Composition thesis: 데스크톱은 다음 단계의 큰 활자와 원형 완료 인장을 상단에 배치하고, 28단계 장부와 평가 기록이 아래로 이어진다. 모바일은 완료 인장 → 2×2 요약 → 단일 열 단계 장부로 재작성한다.
- Type voice: 주요 소리 표식은 명조 계열, 계정·단계·수치는 고정폭 유틸리티 레이블, 본문은 시스템 산세리프.
- Material language: 딥 포리스트 바탕, 따뜻한 아이보리 활자, 세이지 완료 표식, 앰버 다음 단계 표식, 그림자보다 얇은 선과 면으로 깊이를 구분한다.
- Image language: 실제 보컬 데이터가 없는 장식 이미지는 사용하지 않는다.
- Supporting motifs: 28칸 stage ruler, 통과/다음 단계를 표시하는 짧은 상단 마크.
- Motion score: 첫 화면의 320ms 단일 reveal만 허용하고 지속 애니메이션은 없다.
- Mobile rewrite: 360px에서 인증 2열을 단일 흐름으로 바꾸고, 단계 그리드는 한 열, 평가 지표는 세 줄로 재배치하며 모든 버튼·입력은 44px 이상이다.
- Execution budget: DOM/CSS 중심, 캔버스·셰이더·영상·프레임 단위 업데이트 없음, 최대 28단계와 최근 평가 20건.
- Refusals: 보라 그래디언트, generic bento, 개발 스택 배지, 가짜 성과 수치, 장식용 파티클, animated grain.

## Evidence status

- Static implementation review: PASS — 인증, 로딩, 오류, 빈 평가, 실제 진도, 실제 평가, 로그아웃 상태가 모두 별도 코드 경로로 존재한다.
- Data truth review: PASS — 화면 수치는 `/api/me/dashboard`의 현재 사용자 프로필·진도·평가와 정적 HLB 28단계 명칭만 사용한다.
- Accessibility contract: PASS — 타입체크와 Biome 접근성 규칙을 통과했고 입력 레이블, alert, focus-visible, 44px 이상 컨트롤, reduced-motion 분기가 구현됐다.
- Desktop primary capture: NOT VERIFIED — 현재 Codex 인앱 브라우저 연결이 복구되지 않아 스크린샷 기반 판정을 만들지 않았다.
- 360px capture and overflow measurement: NOT VERIFIED — 브라우저 실측 전에는 PASS로 올리지 않는다.
- Error/empty/reduced-motion visual capture: NOT VERIFIED — 코드 경로는 존재하지만 실제 표면 증거가 없다.
- ART DIRECTION: CANDIDATE DISTINCTIVE
- CRAFT: NOT YET VERIFIED
- final visual result: PENDING. 화면 실측 전에는 agent-side high-end 최종 PASS로 선언하지 않는다.
