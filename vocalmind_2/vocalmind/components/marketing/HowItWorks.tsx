import { IconLock, IconTarget, IconMic, IconChart } from '@/components/shared/Icons';
import { GlowCard } from '@/components/ui/glow-card';

const STEPS = [
  { icon: <IconLock size={26} />, num: '01', title: '무료 가입', desc: '30초면 가입 완료. 무료로 18단계까지 체험하세요.' },
  { icon: <IconTarget size={26} />, num: '02', title: '목표 설정', desc: '현재 수준과 목표를 알려주면 AI가 맞춤 커리큘럼을 설계합니다.' },
  { icon: <IconMic size={26} />, num: '03', title: 'AI와 연습',  desc: '노래하면 AI가 실시간으로 분석하고 즉시 피드백을 전달합니다.' },
  { icon: <IconChart size={26} />, num: '04', title: '성장 확인',  desc: '매주 성장 리포트로 내 목소리가 얼마나 발전했는지 확인하세요.' },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-24 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto px-7">
        <div className="section-head center reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>사용 방법</div>
          <h2 className="section-title">4단계로 <em>시작하세요</em></h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            복잡한 설정 없이, 지금 당장 노래하면서 AI 코칭을 경험할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {STEPS.map((step) => (
            <GlowCard key={step.num} className="p-8 text-center">
              <div className="text-5xl font-mono font-bold mb-3" style={{ color: 'var(--accent)', opacity: 0.3 }}>{step.num}</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{step.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{step.desc}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
