# 보컬마인드 AI 스튜디오 실패 기록

> 마스터 각인(feedback_vocalmind_bond_quality_first.md): "최고 품질 + 낭비 방지"
>
> **이 파일은 세션마다 맨 먼저 읽는다.** 반복된 실수는 돈이 새어나가는 구멍이다.
>
> 새 실패 발생 시 즉시 append. 해결 완료된 실패도 지우지 않는다 (미래 세션 학습용).

---

## 실패 #0 (시드 — 과거 교훈 박제, 2026-04-11)
- **시도한 방식**: 검증 목적으로 실제 영상 생성 API를 반복 호출 (크루즈자동 선례)
- **결과**: $30+ 비용 폭주 + 좀비 프로세스 증폭
- **근본 원인**: "빠른 반복이 디버깅에 필요"라는 착각. pytest mock으로 충분했음
- **재발 방지 규칙**:
  - Runware 실호출은 작업당 최대 1회
  - 실패 시 재호출 전 반드시 원인 분석 30분 이상
  - pytest mock + `RUNWARE_DRY_RUN=1`로 선검증 의무

---

## 실패 #1 (2026-04-18, Phase B 이미지 3티어 비교 1차 호출)
- **시도한 방식**: Draft(FLUX Schnell 1024×576) / Pro(Seedream 4.5 **1920×1080**) / Studio(Seedream 5.0 Lite **2048×1152**)로 동일 프롬프트 이미지 1장씩 실호출
- **결과**:
  - Draft ✅ 성공 (cost≈$0.0006, 2.6초)
  - Pro ❌ **Runware 400 invalidPixels** (총 픽셀 2.07M, 모델 하한 3.68M 미달)
  - Studio ❌ **Runware 400 invalidPixels** (총 픽셀 2.36M, 모델 하한 3.68M 미달)
- **근본 원인**: 카탈로그(`runware_catalog.py`) 설계 시 "Full HD=1080p, 2K=2048"이라는 일반 상식에 묶여서 **Seedream 계열의 '최소 총 픽셀' 제약**을 확인하지 않음. Runware 문서에 "Total pixels must be between 3,686,400 and 16,777,216"으로 명시돼 있었으나 놓침
- **재발 방지 규칙**:
  1. 새 모델 카탈로그 등록 시 공식 문서의 **dimensions constraint를 상수로 기록** (`MODEL_MIN_PIXELS` 맵)
  2. `test_runware_catalog`에 **모든 티어 해상도가 해당 모델 min_pixels 만족하는지** 사전 검증 테스트 추가
  3. `generate_image_with_cost`에서 API 호출 전 클라이언트 측 선검증 → 400 받기 전에 `ValueError`로 차단
  4. 새 모델 추가 → 모델 문서 2번 읽기 (한 번은 dimensions, 한 번은 required fields)
- **수정 해상도 (결정)**:
  - Pro: 1920×1080 → **2560×1440** (QHD, 정확히 3.68M = 하한 통과)
  - Studio: 2048×1152 → **2880×1620** (3K, 4.67M = 여유 통과)

---

## 실패 #2 (2026-04-18, Phase B 직후 프론트 동기화 누락 — 실물 UI 검증에서 발견)
- **시도한 방식**: 백엔드 `runware_catalog.py`의 Pro/Studio 이미지 해상도를 2560×1440 / 2880×1620로 교정 (실패 #1 수정). 프론트 `types/studio.ts STUDIO_TIERS.imageResolution`은 갱신하지 않음
- **결과**: dev 서버에서 `/pricing/tier-preview` 스크린샷 확인 시 카드 UI에 **구 해상도(1920×1080 / 2048×1152)** 가 표시. 실제 백엔드는 QHD/3K로 호출 → UI와 실행 결과 불일치. 유저 혼란 + 신뢰도 손상 위험
- **근본 원인**:
  1. 품질 티어의 "진실의 근원"이 **백엔드 상수와 프론트 상수에 이중 정의**돼 있음. 한 곳 수정하면 다른 곳 동기화 잊기 쉬움
  2. 마이그레이션 뷰 `studio_tier_catalog`를 만들어 놓고 BFF가 활용하지 않아 여전히 프론트 하드코딩 상수에 의존
  3. 배포 전 실물 스크린샷 검증이 없었음 — pytest/tsc는 값 불일치를 감지 못 함
- **재발 방지 규칙**:
  1. `backend/infra/runware_catalog.py` 수정 시 **체크리스트**: `types/studio.ts STUDIO_TIERS` · `supabase/migrations/*_studio_quality_tiers.sql` (뷰) 3곳 동시 확인. 커밋 전 `grep -n "이전 값" -r .` 로 잔재 탐색
  2. 중기 목표: BFF가 Supabase `studio_tier_catalog` 뷰를 `GET /api/studio/tiers`로 노출해 프론트가 실시간 조회 → 상수 이중화 해소
  3. `STUDIO_TIERS` 주석 상단에 "backend `runware_catalog.TIERS`와 동기화 필수" 경고 박제
  4. 품질 티어 관련 PR은 배포 전 `/pricing/tier-preview`(dev 전용) 스크린샷 1장 필수 첨부
- **수확**: "실물 확인" 원칙의 가치 입증. 마스터 지시가 없었다면 다음 세션 유저가 처음 겪었을 버그.

---

## 실패 #3 (의심, 다음 세션 즉시 검증 대상) — FLUX AIR 상수 이름-실체 불일치
- **단서**: 글로벌 메모리 `reference_runware_air_catalog.md` (2026-04-18 실 호출 검증)에 따르면:
  - `runware:100@1` = **FLUX.1 Schnell** (저렴, 빠름)
  - `runware:101@1` = **FLUX.1 Dev** (고급, 비쌈)
  - 크루즈자동 프로젝트 상수 이름이 과거 명명 오류로 실제와 뒤바뀜 (`FLUX_SCHNELL = "runware:101@1"` ← 실제는 Dev)
- **현재 보컬마인드 카탈로그 상태** (`backend/infra/runware_catalog.py`):
  - `MODEL_IMAGE_FLUX_SCHNELL = "runware:101@1"` → **실제 Dev일 가능성 높음**
  - `MODEL_IMAGE_FLUX_DEV = "runware:100@1"` → **실제 Schnell일 가능성 높음**
- **영향 (확인 전)**: Phase B Round 1 Draft 티어 1회 호출(예상 $0.0006 Schnell)이 실제로는 Dev 호출($0.0038)이었을 수 있음. 약 6배 단가. 아직 대시보드 미확인이라 "cost=$0.0" 리포트로는 구분 불가
- **검증 절차 (다음 세션 1순위)**:
  1. Runware 공식 `/docs/models` 에서 `runware:100@1` vs `runware:101@1` 문서 직접 확인
  2. 또는 `runware:100@1`로 1장 테스트 호출(steps=4)해 응답 시간/가격 비교
  3. 확정되면 `runware_catalog.py` 상수 값 스왑 + `test_runware_catalog::test_draft_uses_cheap_models` 의 assert 값 교정
- **재발 방지 규칙**:
  1. AIR 상수 추가 시 **공식 문서 URL + 1회 실 호출 검증 결과**를 주석으로 박제
  2. 다른 프로젝트의 상수 이름을 복붙하지 말 것. 이름은 오류 가능. AIR 문자열만 신뢰
  3. 티어별 Draft 호출 샘플을 주기적으로 Runware 대시보드에서 실 과금 대조
