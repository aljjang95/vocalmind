'use client';

import { usePracticeStore } from '@/stores/practiceStore';
import type { Song } from '@/types';

interface RhythmToggleProps {
  song: Song | null;
}

/**
 * 박자 분석 ON/OFF 토글.
 * - beatGridUrl 없는 곡: 비활성화 + 툴팁
 * - ON 최초 활성화 시 캘리브레이션 위저드는 상위 컴포넌트에서 처리
 */
export default function RhythmToggle({ song }: RhythmToggleProps) {
  const { rhythmEnabled, setRhythmEnabled } = usePracticeStore();

  const available = Boolean(song?.beatGridUrl);
  const disabled = !available;

  return (
    <div className="flex items-center gap-3">
      <label
        className={`inline-flex items-center gap-2 text-xs font-medium ${
          disabled ? 'text-[var(--muted)] cursor-not-allowed' : 'text-[var(--text2)] cursor-pointer'
        }`}
        title={disabled ? '이 곡은 박자 분석이 지원되지 않습니다' : undefined}
      >
        <span>박자 분석</span>
        <button
          type="button"
          role="switch"
          aria-checked={rhythmEnabled && available}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => setRhythmEnabled(!rhythmEnabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            rhythmEnabled && available
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--surface2)]'
          } ${disabled ? 'opacity-40' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              rhythmEnabled && available ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
      {disabled && (
        <span className="text-[10px] text-[var(--muted)]">박자 정보 준비 중</span>
      )}
    </div>
  );
}
