export type CurriculumStage = {
  id: number
  block: string
  name: string
}

export const curriculum: CurriculumStage[] = [
  { id: 1, block: '이완 기초', name: '설근 안정화' },
  { id: 2, block: '이완 기초', name: '후두 안정' },
  { id: 3, block: '이완 기초', name: '이완 라운딩' },
  { id: 4, block: '호흡/허밍', name: '복식호흡 기초' },
  { id: 5, block: '호흡/허밍', name: '허밍 세팅' },
  { id: 6, block: '호흡/허밍', name: '백프레셔 허밍' },
  { id: 7, block: '모음 순화', name: '모음 5개 라운딩' },
  { id: 8, block: '모음 순화', name: '모음 연결' },
  { id: 9, block: '모음 순화', name: '모음 조합' },
  { id: 10, block: '발음 확장', name: '옴 허밍' },
  { id: 11, block: '발음 확장', name: '멈 체킹' },
  { id: 12, block: '발음 확장', name: '국 두성밸런스' },
  { id: 13, block: '발음 확장', name: '1.5옥타브 스케일' },
  { id: 14, block: '세팅 훈련', name: '복압 바람불기' },
  { id: 15, block: '세팅 훈련', name: '허 복부 반응' },
  { id: 16, block: '세팅 훈련', name: '성대 접촉 세팅' },
  { id: 17, block: '세팅 훈련', name: '세팅 유지 스케일' },
  { id: 18, block: '두성/연결', name: '두성 밸런스' },
  { id: 19, block: '두성/연결', name: '두성 선창' },
  { id: 20, block: '두성/연결', name: '성구전환 체험' },
  { id: 21, block: '두성/연결', name: '말자리 훈련' },
  { id: 22, block: '두성/연결', name: '음정 연결' },
  { id: 23, block: '고음/표현', name: '고음 세팅' },
  { id: 24, block: '고음/표현', name: '압력 강화' },
  { id: 25, block: '고음/표현', name: '빠사지오 연습' },
  { id: 26, block: '고음/표현', name: '발음별 세팅 유지' },
  { id: 27, block: '실가창', name: '말자리 실가창' },
  { id: 28, block: '실가창', name: '자유 표현' },
]

export function stageById(id: number) {
  return curriculum.find((stage) => stage.id === id) ?? curriculum[0]
}
