import { GlowCard } from '@/components/ui/glow-card';

const STORIES = [
  {
    name: '김지은',
    role: '팝 보컬 연습생 · 6개월 수강',
    before: { label: '시작 전', text: '고음 D4에서 목이 잠기고 소리가 끊겼어요' },
    after:  { label: '3개월 후', text: 'G4까지 안정적으로 연장. AI가 후두 긴장 원인을 찾아줬어요' },
    quote: '레슨 받을 때처럼 "왜 그런지" 설명이 있어요. 유튜브랑 다른 건 그 부분이에요.',
  },
  {
    name: '박민준',
    role: '뮤지컬 지망생 · 오디션 합격',
    before: { label: '시작 전', text: '호흡이 얕아서 한 프레이즈를 끝까지 못 냈어요' },
    after:  { label: '6주 후', text: '복식호흡 세팅 완료. 오디션에서 프레이즈 2개 연결 성공' },
    quote: '4축 분석에서 혀뿌리 긴장이 높다고 나왔는데, 그게 정확히 제 문제였어요.',
  },
  {
    name: '이수아',
    role: 'R&B 싱어송라이터 · 취미 수강',
    before: { label: '시작 전', text: '성구전환 구간에서 소리가 갈라지는 게 고민이었어요' },
    after:  { label: '2개월 후', text: '빠사지오 구간 매끄럽게 통과. 성구전환 점수 78점 달성' },
    quote: '사설 레슨 가격이 부담돼서 못 갔는데, 여기서 오히려 더 구체적인 원인을 찾았어요.',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto px-7">
        <div className="section-head center reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>수강생 변화</div>
          <h2 className="section-title">
            원인을 알면, <em>달라집니다</em>
          </h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            막연히 &quot;더 연습하세요&quot;가 아닌, 정확한 원인 진단 후 개선된 사례들입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {STORIES.map((s) => (
            <GlowCard key={s.name} className="p-8 reveal">
              {/* Before/After */}
              <div className="flex items-start gap-2.5">
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="inline-block text-[0.65rem] font-bold tracking-wider uppercase text-[var(--error)] bg-[var(--error-muted)] rounded px-1.5 py-0.5 w-fit">
                    {s.before.label}
                  </span>
                  <p className="text-[0.82rem] text-[var(--text-secondary)] leading-normal">{s.before.text}</p>
                </div>
                <div className="text-[var(--text-muted)] text-lg flex-shrink-0 pt-4" aria-hidden="true">→</div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="inline-block text-[0.65rem] font-bold tracking-wider uppercase text-[var(--success)] bg-[var(--success-muted)] rounded px-1.5 py-0.5 w-fit">
                    {s.after.label}
                  </span>
                  <p className="text-[0.82rem] text-[var(--text-primary)] font-medium leading-normal">{s.after.text}</p>
                </div>
              </div>

              {/* 구분선 */}
              <div className="h-px bg-[var(--border-subtle)] my-4" />

              {/* 후기 */}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic mt-3 flex-1">
                &ldquo;{s.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3 mt-5">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-muted)] border border-[var(--accent)]/20 flex items-center justify-center text-sm font-bold text-[var(--accent)] flex-shrink-0">
                  {s.name[0]}
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">{s.name}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-px">{s.role}</div>
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
