'use client';

import { useCoachStore } from '@/stores/coachStore';
import { midiToNoteName } from '@/lib/audio/musicUtils';
import { getStageById } from '@/lib/data/hlbCurriculum';

function getCentsClasses(cents: number): {
  noteClass: string;
  gaugeClass: string;
  scoreClass: string;
} {
  const absCents = Math.abs(cents);
  if (absCents <= 15) {
    return {
      noteClass: 'text-[var(--success)]',
      gaugeClass: 'bg-[var(--success)] shadow-[0_0_8px_rgba(34,197,94,0.4)]',
      scoreClass: 'text-[var(--success)]',
    };
  }
  if (absCents <= 30) {
    return {
      noteClass: 'text-[var(--warning)]',
      gaugeClass: 'bg-[var(--warning)] shadow-[0_0_8px_rgba(234,179,8,0.4)]',
      scoreClass: 'text-[var(--warning)]',
    };
  }
  return {
    noteClass: 'text-[var(--error)]',
    gaugeClass: 'bg-[var(--error)] shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    scoreClass: 'text-[var(--error)]',
  };
}

export default function PitchMonitor() {
  const { currentStageId, currentRootNote, currentNoteScores } = useCoachStore();

  const stage = getStageById(currentStageId);
  const pattern = stage?.pattern ?? [];

  const latestNote = currentNoteScores.length > 0
    ? currentNoteScores[currentNoteScores.length - 1]
    : null;

  const noteIndex = latestNote?.noteIndex ?? 0;
  const expectedMidi = pattern.length > 0
    ? currentRootNote + (pattern[Math.min(noteIndex, pattern.length - 1)] ?? 0)
    : currentRootNote;
  const expectedNoteName = midiToNoteName(expectedMidi);

  const userFreq = latestNote?.detectedFrequency ?? 0;
  const userCents = latestNote ? (isFinite(latestNote.cents) ? latestNote.cents : 0) : 0;
  const userScore = latestNote?.score ?? 0;

  const hasPitch = userFreq > 0;
  const userNoteName = hasPitch ? midiToNoteName(
    Math.round(12 * Math.log2(userFreq / 440) + 69)
  ) : '--';

  const classes = hasPitch ? getCentsClasses(userCents) : {
    noteClass: 'text-[var(--muted)]',
    gaugeClass: '',
    scoreClass: '',
  };

  const clampedCents = Math.max(-50, Math.min(50, userCents));
  const gaugePosition = hasPitch ? 50 + (clampedCents / 50) * 50 : 50;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-5 max-[768px]:p-4 text-center">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[var(--fs-xs)] text-[var(--muted)] uppercase tracking-wider">피치 모니터</span>
        {hasPitch && (
          <span className={`text-[var(--fs-xs)] font-bold font-mono px-2 py-0.5 rounded bg-[var(--surface2)] ${classes.scoreClass}`}>
            {userScore}점
          </span>
        )}
      </div>

      {/* Expected vs User note names */}
      <div className="flex items-baseline justify-center gap-6 max-[768px]:gap-4 mb-5">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[var(--fs-xs)] text-[var(--muted)]">목표 음</span>
          <span className="text-[clamp(1.5rem,4vw,2.5rem)] font-extrabold text-white/30 font-mono">
            {expectedNoteName}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[var(--fs-xs)] text-[var(--muted)]">내 음</span>
          <span className={`text-[clamp(1.5rem,4vw,2.5rem)] font-extrabold font-mono transition-colors duration-150 ${classes.noteClass}`}>
            {userNoteName}
          </span>
        </div>
      </div>

      {/* Pitch accuracy gauge */}
      <div className="relative h-6 bg-[var(--surface2)] rounded-xl overflow-hidden mb-3">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 -translate-x-1/2 z-[2]" />
        <div
          className={`absolute top-0.5 bottom-0.5 w-3 rounded-md z-[3] transition-[left] duration-100 ease-out -translate-x-1/2 ${classes.gaugeClass}`}
          style={{ left: `${gaugePosition}%` }}
        />
      </div>

      {/* Cents offset */}
      <div className="text-[var(--fs-sm)] font-mono text-[var(--muted)]">
        {hasPitch
          ? `${userCents > 0 ? '+' : ''}${Math.round(userCents)} cents`
          : '소리를 감지하고 있습니다...'
        }
      </div>
    </div>
  );
}
