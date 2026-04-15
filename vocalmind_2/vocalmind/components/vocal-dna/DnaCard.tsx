'use client';

import type { VocalDna, DnaAxis } from '@/types';
import DnaCanvas from './DnaCanvas';
import styles from './DnaCard.module.css';

const AXIS_LABELS: Record<string, string> = {
  laryngeal: '후두',
  tongue_root: '혀뿌리',
  jaw: '턱',
  register_break: '성구전환',
  tone_stability: '음색안정',
};

interface DnaCardProps {
  dna: VocalDna;
  axes: DnaAxis[];
  userName?: string;
  onShare?: () => void;
  onReanalyze?: () => void;
}

function pitchToNoteLabel(hz: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[((midi % 12) + 12) % 12];
  return `${note}${octave}`;
}

export default function DnaCard({
  dna,
  axes,
  userName = '보컬리스트',
  onShare,
  onReanalyze,
}: DnaCardProps) {
  const pitchLabel = dna.avg_pitch_hz ? pitchToNoteLabel(dna.avg_pitch_hz) : null;

  return (
    <div className={styles.card}>
      {/* 별자리 Canvas */}
      <div className={styles.canvasSection}>
        <DnaCanvas
          axes={axes}
          showLabels
          showValues
        />
      </div>

      {/* 사용자 정보 */}
      <div className={styles.info}>
        <p className={styles.userName}>{userName}</p>
        {dna.voice_type && (
          <p className={styles.voiceType}>{dna.voice_type}</p>
        )}
        {pitchLabel && (
          <p className={styles.pitchRange}>평균 음역 {pitchLabel}</p>
        )}

        <div className={styles.divider} />

        {/* 5축 수치 */}
        <div className={styles.axisGrid}>
          {axes.map((axis) => (
            <div key={axis.key} className={styles.axisItem}>
              <span className={styles.axisLabel}>
                {AXIS_LABELS[axis.key] ?? axis.label}
              </span>
              <div className={styles.axisBarRow}>
                <div className={styles.axisBarTrack}>
                  <div
                    className={styles.axisBarFill}
                    style={{ width: `${axis.value}%` }}
                  />
                </div>
                <span className={styles.axisValue}>
                  {Math.round(axis.value)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        {/* 액션 버튼 */}
        <div className={styles.actions}>
          {onShare && (
            <button
              type="button"
              className={styles.btnShare}
              onClick={onShare}
            >
              공유
            </button>
          )}
          {onReanalyze && (
            <button
              type="button"
              className={styles.btnReanalyze}
              onClick={onReanalyze}
            >
              다시 분석
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
