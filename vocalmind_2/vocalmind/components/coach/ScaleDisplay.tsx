'use client';

import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { midiToNoteName } from '@/lib/audio/musicUtils';
import { getKeyRange } from '@/lib/coach/progressManager';
import { semitonesToInterval } from '@/lib/audio/musicUtils';

export default function ScaleDisplay() {
  const {
    currentStageId,
    currentRootNote,
    currentNoteScores,
    currentPatternScores,
    condition,
  } = useCoachStore();

  const stage = getStageById(currentStageId);
  const pattern = stage?.pattern ?? [];

  if (pattern.length === 0) return null;

  const rootNoteName = midiToNoteName(currentRootNote);

  const keyRangeSemitones = getKeyRange(condition ?? 'normal');
  const startKey = currentRootNote - (currentPatternScores.length > 0
    ? currentPatternScores.length
    : 0);
  const baseStartKey = 48;
  const endKey = baseStartKey + keyRangeSemitones;
  const keyProgress = endKey > baseStartKey
    ? Math.min(100, ((currentRootNote - baseStartKey) / (endKey - baseStartKey)) * 100)
    : 0;

  const startKeyName = midiToNoteName(baseStartKey);
  const endKeyName = midiToNoteName(endKey);

  const latestNoteIndex = currentNoteScores.length > 0
    ? currentNoteScores[currentNoteScores.length - 1].noteIndex
    : -1;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] px-5 py-4 max-[768px]:px-4 max-[768px]:py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[var(--fs-xs)] text-[var(--muted)] uppercase tracking-wider">스케일 진행</span>
        <span className="text-[var(--fs-sm)] font-bold text-[var(--accent-lt)] font-mono">{rootNoteName}</span>
      </div>

      {/* Pattern note dots */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {pattern.map((interval, idx) => {
          const isPlayed = idx < latestNoteIndex;
          const isCurrent = idx === latestNoteIndex;

          return (
            <div
              key={idx}
              className={`w-7 h-7 max-[768px]:w-6 max-[768px]:h-6 rounded-full border-2 flex items-center justify-center text-[9px] max-[768px]:text-[8px] font-bold font-mono transition-all duration-200 ${
                isCurrent
                  ? 'border-[var(--accent-lt)] bg-[rgba(59,130,246,0.35)] text-[var(--text)] shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                  : isPlayed
                  ? 'border-[var(--accent)] bg-[rgba(59,130,246,0.2)] text-[var(--accent-lt)]'
                  : 'border-[var(--border2)] text-[var(--muted)]'
              }`}
            >
              {semitonesToInterval(interval)}
            </div>
          );
        })}
      </div>

      {/* Key range progress */}
      <div className="mt-1">
        <div className="flex justify-between text-[var(--fs-xs)] text-[var(--muted)] mb-1.5 font-mono">
          <span>{startKeyName}</span>
          <span>{endKeyName}</span>
        </div>
        <div className="h-1 bg-[var(--surface2)] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[var(--accent2)] rounded-sm transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(0, keyProgress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
