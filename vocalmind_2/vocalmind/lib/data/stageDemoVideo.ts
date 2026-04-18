/**
 * 28단계별 시범 영상 데이터 (YouTube 커리큘럼 시리즈 자막 분석 기반)
 *
 * 영상 카탈로그:
 *   qZw20taAp18 = 1화 "목에 힘 들어가는 이유" (~20분)
 *   klkXYLy4sY0 = 2화3-2 "복식호흡과 성대 세팅" (~23분)
 *   gQqQVqAeMQw = 2화3-3 "성대 붙이기 유지 훈련" (~9분)
 *   PnmSVKj5YjI = 4화 "고음 연습, 또 다른 접근법" (~15분)
 *   2AhK6LFo4wo = 5화 "성구전환 믹스보이스 기준" (~37분)
 *  -5D8f1_90A4  = 6화 "힘 안 들이는 법 + 애국가" (~21분)
 *   rPppnN0mC-Q = 7화 "성구전환 Honesty" (자막 없음)
 *   8BiPkJplixA = "고음 낼 때 소리를 어디로 보내야 할까?" (~7분)
 *   y_vAEBJ3V0Y = "성대세팅 종합" (~26분)
 *
 * 2026-04-18: yt-dlp 자막 추출 후 30초 청크 분석으로 전체 재매핑
 */
export const stageDemoVideo: Record<number, { videoId: string; startSec: number; endSec: number }> = {
  // ── Block 1: 이완 기초 (1~3) — 1화 기반 ──
  1:  { videoId: 'qZw20taAp18', startSec: 60,  endSec: 100 },  // 1화 01:00 "고개 제치고 설근+턱 떨어뜨리기 + 편안한 어~ 시범"
  2:  { videoId: 'qZw20taAp18', startSec: 90,  endSec: 120 },  // 1화 01:30 "릴렉스 상태 + 후두 내려앉기 + 편안한 소리 길게"
  3:  { videoId: 'qZw20taAp18', startSec: 150, endSec: 190 },  // 1화 02:30 "음정 올라갈 때 이완 유지 + 선택적 주의력"

  // ── Block 2: 호흡/허밍 (4~6) — 2화3-2(호흡) + 1화(허밍) ──
  4:  { videoId: 'klkXYLy4sY0', startSec: 120, endSec: 160 },  // 2화3-2 02:00 "복식호흡 시범 — 코로 천천히 마시기"
  5:  { videoId: 'qZw20taAp18', startSec: 690, endSec: 730 },  // 1화 11:30 "허밍 시작 — 입술 덮어서 흠~ + 안정 유지"
  6:  { videoId: 'klkXYLy4sY0', startSec: 300, endSec: 340 },  // 2화3-2 05:00 "복식호흡 유지하며 발성 + 70% 압력 세팅"

  // ── Block 3: 모음 순화 (7~9) — 1화 + 2화3-3 + 6화 ──
  7:  { videoId: 'qZw20taAp18', startSec: 442, endSec: 472 },  // 1화 07:22 "5모음 라운딩 유지 시범"
  8:  { videoId: 'gQqQVqAeMQw', startSec: 5,   endSec: 35  },  // 2화3-3 00:05 "성대 붙이기 + 모음 연결 유지"
  9:  { videoId: '-5D8f1_90A4', startSec: 120, endSec: 160 },  // 6화 02:00 "허헤히호 순화 + 복부 압력 연동"

  // ── Block 4: 발음 확장 (10~13) — 성대세팅 + 6화 ──
  10: { videoId: 'y_vAEBJ3V0Y', startSec: 300, endSec: 330 },  // 성대세팅 05:00 "입술 닫으면 코 바람 빠지는 위치로 허밍 포지셔닝"
  11: { videoId: 'y_vAEBJ3V0Y', startSec: 560, endSec: 600 },  // 성대세팅 09:20 "멈이라는 발음 — 멈몸멈몸멈 시범"
  12: { videoId: '-5D8f1_90A4', startSec: 360, endSec: 390 },  // 6화 06:00 "국발음으로 꾹꾹꾹 — 두성밸런스 스케일"
  13: { videoId: 'y_vAEBJ3V0Y', startSec: 630, endSec: 660 },  // 성대세팅 10:30 "안정 벗어나지 않는 음역대까지 멈 1.5옥타브"

  // ── Block 5: 세팅 훈련 (14~17) — 6화 + 4화 + 5화 ──
  14: { videoId: '-5D8f1_90A4', startSec: 210, endSec: 240 },  // 6화 03:30 "주먹 쥐고 바람불기 + 스타카토 10번 + 배 압력 100"
  15: { videoId: 'PnmSVKj5YjI', startSec: 60,  endSec: 100 },  // 4화 01:00 "복부 압력 100→70 세팅 후 흠마 발성"
  16: { videoId: 'PnmSVKj5YjI', startSec: 205, endSec: 235 },  // 4화 03:25 "세팅 후 안정 유지하며 도약 올라가기"
  17: { videoId: '2AhK6LFo4wo', startSec: 420, endSec: 460 },  // 5화 07:00 "흠 세팅→매일같이 올라갔다 내려오기 스케일"

  // ── Block 6: 두성/연결 (18~22) — 6화 + 성대세팅 + 5화 ──
  18: { videoId: '-5D8f1_90A4', startSec: 150, endSec: 190 },  // 6화 02:30 "진성~가성 경계 허물어지듯 + 두성밸런스 라운딩"
  19: { videoId: '-5D8f1_90A4', startSec: 660, endSec: 690 },  // 6화 11:00 "두성밸런스 선창 — 동해물과 애국가"
  20: { videoId: 'y_vAEBJ3V0Y', startSec: 870, endSec: 900 },  // 성대세팅 14:30 "빠사지오 — 성구가 자연스럽게 넘어가지는 체험"
  21: { videoId: '2AhK6LFo4wo', startSec: 390, endSec: 420 },  // 5화 06:30 "순화 상태에서 말자리 해주기 + 압력 유지"
  22: { videoId: 'y_vAEBJ3V0Y', startSec: 1170, endSec: 1200 }, // 성대세팅 19:30 "순화에 집중→저음~고음 이질감 없이 연결"

  // ── Block 7: 고음/표현 (23~26) — 4화 + 성대세팅 + 5화 ──
  23: { videoId: 'PnmSVKj5YjI', startSec: 180, endSec: 210 },  // 4화 03:00 "한 번에 가보는 연습 — 세팅 후 도약해서 올라가기"
  24: { videoId: 'PnmSVKj5YjI', startSec: 300, endSec: 330 },  // 4화 05:00 "고음일수록 세팅을 더해 줘서 성대 붙이기"
  25: { videoId: 'y_vAEBJ3V0Y', startSec: 1320, endSec: 1350 }, // 성대세팅 22:00 "빠사지오 구간(이옥타브솔) 꾹꾹 통과 시범"
  26: { videoId: '2AhK6LFo4wo', startSec: 240, endSec: 270 },  // 5화 04:00 "라운딩 시 안정만 관찰 + 발음별 순화 유지"

  // ── Block 8: 실가창 (27~28) — 6화 ──
  27: { videoId: '-5D8f1_90A4', startSec: 900, endSec: 930 },  // 6화 15:00 "말자리 유지하며 동해물과 실가창 시범"
  28: { videoId: '-5D8f1_90A4', startSec: 1080, endSec: 1110 }, // 6화 18:00 "안정+70% 압력 유지한 채 실가창 종합 시범"
};
