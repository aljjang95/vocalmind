'use client';

import { useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { PracticeMode } from '@/types';

export default function ModeSwitcher() {
  const { mode, setMode } = usePracticeStore();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<PracticeMode | null>(null);

  const handleModeClick = useCallback((newMode: PracticeMode) => {
    if (newMode === mode) return;

    if (newMode === 'play') {
      setPendingMode(newMode);
      setShowWarning(true);
    } else {
      setMode(newMode);
    }
  }, [mode, setMode]);

  const confirmModeChange = useCallback(() => {
    if (pendingMode) {
      setMode(pendingMode);
    }
    setShowWarning(false);
    setPendingMode(null);
  }, [pendingMode, setMode]);

  const cancelModeChange = useCallback(() => {
    setShowWarning(false);
    setPendingMode(null);
  }, []);

  return (
    <>
      <div className="flex gap-1 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-1">
        <button
          className={`flex-1 flex flex-col items-center gap-0.5 px-4 py-3 bg-transparent border rounded-lg cursor-pointer transition-all ${
            mode === 'practice'
              ? 'bg-[var(--surface2)] border-[var(--accent)] [&_.mode-icon]:opacity-100 [&_.mode-label]:text-[var(--text)] [&_.mode-desc]:text-[var(--accent-lt)]'
              : 'border-transparent hover:bg-[var(--surface)] [&_.mode-icon]:opacity-60'
          }`}
          onClick={() => handleModeClick('practice')}
        >
          <span className="mode-icon text-xl">&#9881;</span>
          <span className="mode-label text-sm font-bold text-[var(--text2)]">Practice</span>
          <span className="mode-desc text-xs text-[var(--muted)]">구간 연습</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center gap-0.5 px-4 py-3 bg-transparent border rounded-lg cursor-pointer transition-all ${
            mode === 'play'
              ? 'bg-[var(--surface2)] border-[var(--accent)] [&_.mode-icon]:opacity-100 [&_.mode-label]:text-[var(--text)] [&_.mode-desc]:text-[var(--accent-lt)]'
              : 'border-transparent hover:bg-[var(--surface)] [&_.mode-icon]:opacity-60'
          }`}
          onClick={() => handleModeClick('play')}
        >
          <span className="mode-icon text-xl">&#9836;</span>
          <span className="mode-label text-sm font-bold text-[var(--text2)]">Play</span>
          <span className="mode-desc text-xs text-[var(--muted)]">전곡 도전</span>
        </button>
      </div>

      {showWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={cancelModeChange}>
          <div className="bg-[var(--bg2)] border border-[var(--border2)] rounded-xl p-7 max-w-[400px] w-[90%]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-[var(--text)] mb-3">Play 모드 전환</div>
            <p className="text-sm text-[var(--text2)] leading-[1.7] mb-6">
              Play 모드에서는 전곡을 처음부터 끝까지 부릅니다.<br />
              MR이 재생되면서 마이크로 녹음하고, 곡이 끝나면 채점 결과를 확인할 수 있습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="px-[18px] py-2 bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] rounded-md text-sm cursor-pointer transition-colors hover:bg-[var(--surface3)]" onClick={cancelModeChange}>
                취소
              </button>
              <button className="px-[18px] py-2 bg-[var(--accent)] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90" onClick={confirmModeChange}>
                전환하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
