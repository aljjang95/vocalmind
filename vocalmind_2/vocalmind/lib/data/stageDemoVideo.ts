/**
 * 28단계별 시범 영상 데이터 (YouTube 12편에서 자동 매핑)
 * ChromaDB vocal_feedback 메타데이터 기반 — 각 단계에 가장 관련 높은 영상 구간
 * 누락 단계(11, 20, 21, 22)는 YouTube 피드백이 없어 영상 없음 → 오디오/TTS 폴백
 */
export const stageDemoVideo: Record<number, { videoId: string; startSec: number; endSec: number }> = {
  1:  { videoId: 'gQqQVqAeMQw', startSec: 0,   endSec: 28  },
  2:  { videoId: 'gQqQVqAeMQw', startSec: 245, endSec: 275 },
  3:  { videoId: 'rPppnN0mC-Q', startSec: 342, endSec: 372 },
  4:  { videoId: 'klkXYLy4sY0', startSec: 18,  endSec: 48  },
  5:  { videoId: 'rPppnN0mC-Q', startSec: 339, endSec: 369 },
  6:  { videoId: 'qZw20taAp18', startSec: 3,   endSec: 33  },
  7:  { videoId: 'qZw20taAp18', startSec: 442, endSec: 472 },
  8:  { videoId: 'gQqQVqAeMQw', startSec: 5,   endSec: 35  },
  9:  { videoId: '-5D8f1_90A4', startSec: 110, endSec: 140 },
  10: { videoId: 'y_vAEBJ3V0Y', startSec: 897, endSec: 927 },
  12: { videoId: 'qZw20taAp18', startSec: 128, endSec: 158 },
  13: { videoId: 'qZw20taAp18', startSec: 29,  endSec: 59  },
  14: { videoId: 'qZw20taAp18', startSec: 152, endSec: 182 },
  15: { videoId: 'PnmSVKj5YjI', startSec: 51,  endSec: 81  },
  16: { videoId: 'PnmSVKj5YjI', startSec: 205, endSec: 235 },
  17: { videoId: '2AhK6LFo4wo', startSec: 72,  endSec: 102 },
  18: { videoId: 'klkXYLy4sY0', startSec: 15,  endSec: 45  },
  19: { videoId: 'gQqQVqAeMQw', startSec: 69,  endSec: 99  },
  23: { videoId: 'PnmSVKj5YjI', startSec: 598, endSec: 628 },
  24: { videoId: 'PnmSVKj5YjI', startSec: 57,  endSec: 87  },
  25: { videoId: 'y_vAEBJ3V0Y', startSec: 898, endSec: 928 },
  26: { videoId: '-5D8f1_90A4', startSec: 382, endSec: 412 },
  27: { videoId: '8BiPkJplixA', startSec: 51,  endSec: 81  },
  28: { videoId: '-5D8f1_90A4', startSec: 285, endSec: 315 },
};
