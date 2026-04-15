'use client';

import { useRef, useState, useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';

const STAGE_ICONS = ['🌱', '🌿', '🎵', '🔊', '⚙️', '🎤', '🎶', '✨'];

export default function StepRoadmap() {
  const { result, isPlayingTts, setPlayingTts, setStep } = useOnboardingStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!result) return null;
  const { consultation } = result;

  const playTts = async () => {
    setPlayingTts(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: consultation.summary }),
      });
      if (!res.ok) throw new Error('TTS 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingTts(false); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlayingTts(false); audioRef.current = null; };
      audio.play();
    } catch {
      setPlayingTts(false);
    }
  };

  const stopTts = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingTts(false);
  };

  return (
    <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold mb-2">맞춤 로드맵</h3>
      <p className="text-[0.9rem] text-[var(--text-secondary)] mb-7 leading-relaxed">
        분석 결과를 바탕으로 AI가 설계한 학습 경로입니다.
      </p>

      {/* 여정 맵 */}
      <div className="relative mb-7">
        {/* 연결선 */}
        <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-[var(--accent)] via-purple-500 to-[var(--accent)] opacity-30" />

        <div className="flex flex-col gap-4">
          {consultation.roadmap.map((item, i) => (
            <div
              key={i}
              className="relative flex items-start gap-4 pl-1"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {/* 노드 */}
              <div className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--accent)]/40 flex items-center justify-center text-base shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                {STAGE_ICONS[i % STAGE_ICONS.length]}
              </div>

              {/* 카드 */}
              <div className="flex-1 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.7rem] font-bold text-[var(--accent-light)] bg-[var(--accent)]/[0.08] px-2 py-0.5 rounded">
                    STEP {i + 1}
                  </span>
                </div>
                <p className="text-[0.88rem] text-[var(--text-secondary)] leading-relaxed">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 추천 시작 단계 */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-[var(--accent)]/[0.06] to-purple-500/[0.04] border border-[var(--accent)]/20 rounded-xl mb-7">
        <div className="shrink-0 w-12 h-12 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
          <span className="text-xl">🎯</span>
        </div>
        <div>
          <div className="text-[0.78rem] text-[var(--text-muted)]">추천 시작 단계</div>
          <div className="font-mono text-[1.1rem] font-bold text-[var(--accent-light)]">
            Stage {consultation.suggested_stage_id}
          </div>
        </div>
      </div>

      {/* TTS 버튼 */}
      <button
        type="button"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-secondary)] text-[0.85rem] cursor-pointer transition-all duration-200 mb-7 hover:enabled:border-[var(--accent)]/30 hover:enabled:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={isPlayingTts ? stopTts : playTts}
      >
        {isPlayingTts ? '⏹ 재생 중지' : '▶ 상담 요약 듣기'}
      </button>

      <div className="flex justify-end mt-4">
        <Button variant="default" size="lg" onClick={() => setStep(4)}>
          플랜 선택하기
        </Button>
      </div>
    </div>
  );
}
