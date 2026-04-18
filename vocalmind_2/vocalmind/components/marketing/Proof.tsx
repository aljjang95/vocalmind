import Image from 'next/image';

const STATS = [
  { num: '28단계', label: '체계적 커리큘럼', sub: '이완 기초 → 실가창까지' },
  { num: '4축', label: '긴장 분석', sub: '후두·혀뿌리·턱·성구전환' },
  { num: '18단계', label: '무료 체험', sub: '카드 없이 지금 시작' },
  { num: '24시간', label: 'AI 코치 상담', sub: '예약 없이 즉시 답변' },
  { num: 'Praat', label: '음성학 분석', sub: '국제 표준 분석 엔진' },
];

export default function Proof() {
  return (
    <section id="proof" className="py-24 border-b border-white/[0.06] relative overflow-hidden">
      {/* 배경 이미지 */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1920&q=80"
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          className="object-cover brightness-[0.08] saturate-[0.3]"
        />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 md:gap-10">
        {STATS.map((s) => (
          <div key={s.num} className="text-center py-2">
            <span
              className="text-2xl md:text-3xl font-mono font-bold text-[var(--accent-light)]"
              style={{ textShadow: '0 0 20px rgba(80,180,120,0.3)' }}
            >
              {s.num}
            </span>
            <span className="text-sm text-[var(--text-secondary)] mt-2 block">{s.label}</span>
            <span className="text-xs md:text-[13px] text-[var(--text-muted)] block leading-relaxed mt-0.5">{s.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
