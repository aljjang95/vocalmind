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
