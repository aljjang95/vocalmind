'use client';

import { useBreathingStore } from '@/stores/breathingStore';

export default function BreathVisualizer() {
  const breathData = useBreathingStore((s) => s.breathData);
  const isActive = useBreathingStore((s) => s.isActive);
  const currentExhaleDuration = useBreathingStore((s) => s.currentExhaleDuration);
  const sessionBest = useBreathingStore((s) => s.sessionBest);

  const isBreathing = breathData?.isBreathing ?? false;
  const rms = breathData?.rms ?? 0;

  // Scale range: 1.0 (idle) to 1.8 (max breath)
  const scaleFactor = isActive && isBreathing
    ? 1.0 + Math.min(rms * 8, 0.8)
    : 1.0;

  const formattedTime = currentExhaleDuration.toFixed(1);

  let statusMessage = '시작 버튼을 눌러 호흡 훈련을 시작하세요';
  let statusBreathing = false;
  if (isActive && isBreathing) {
    statusMessage = '호흡 감지 중...';
    statusBreathing = true;
  } else if (isActive && !isBreathing) {
    statusMessage = '호흡을 시작하세요';
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative w-[220px] h-[220px] flex items-center justify-center max-md:w-[180px] max-md:h-[180px]">
        <div
          className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${
            isActive && isBreathing ? 'border-green-500/40' : 'border-[var(--border)]'
          }`}
        />
        <div
          className={`w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center transition-all duration-100 ease-out will-change-transform max-md:w-[100px] max-md:h-[100px] ${
            isActive && isBreathing
              ? 'bg-green-500/[0.12] shadow-[0_0_40px_rgba(34,197,94,0.15)]'
              : 'bg-[var(--surface2)]'
          }`}
          style={{ transform: `scale(${scaleFactor})` }}
        >
          <span className="text-[2.2rem] font-extrabold text-[var(--text)] leading-none tabular-nums max-md:text-[1.8rem]">
            {formattedTime}
          </span>
          <span className="text-xs text-[var(--text2)] mt-1">초</span>
        </div>
      </div>

      <p className={`text-sm text-center ${statusBreathing ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
        {statusMessage}
      </p>

      {sessionBest > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm text-[var(--text2)]">
          <span>세션 최고</span>
          <span className="font-bold text-[var(--accent)]">{sessionBest.toFixed(1)}초</span>
        </div>
      )}
    </div>
  );
}
