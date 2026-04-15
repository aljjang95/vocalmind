'use client';

import { useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { SongSection } from '@/types';

const SECTION_COLORS: Record<SongSection['type'], string> = {
  intro:   'rgba(139, 92, 246, 0.5)',
  verse:   'rgba(59, 130, 246, 0.5)',
  chorus:  'rgba(234, 179, 8, 0.5)',
  bridge:  'rgba(34, 197, 94, 0.5)',
  outro:   'rgba(139, 92, 246, 0.3)',
  other:   'rgba(113, 113, 122, 0.4)',
};

const SECTION_DOT_COLORS: Record<SongSection['type'], string> = {
  intro:   '#8B5CF6',
  verse:   '#3B82F6',
  chorus:  '#EAB308',
  bridge:  '#22C55E',
  outro:   '#A78BFA',
  other:   '#71717A',
};

interface Props {
  onSeek: (time: number) => void;
}

export default function SectionTabs({ onSeek }: Props) {
  const {
    currentAnalysis,
    currentTime,
    duration,
    setLoop,
  } = usePracticeStore();

  const sections: SongSection[] = currentAnalysis?.sections ?? [];

  const activeSectionIndex = useMemo(() => {
    if (sections.length === 0) return -1;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (currentTime >= sections[i].startTime && currentTime < sections[i].endTime) {
        return i;
      }
    }
    return -1;
  }, [sections, currentTime]);

  const handleTabClick = useCallback((section: SongSection) => {
    onSeek(section.startTime);
  }, [onSeek]);

  const handleTabDoubleClick = useCallback((section: SongSection) => {
    setLoop(section.startTime, section.endTime);
  }, [setLoop]);

  const handleSegmentClick = useCallback((section: SongSection) => {
    onSeek(section.startTime);
  }, [onSeek]);

  if (sections.length === 0) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-4 py-3">
        <div className="text-xs text-[var(--muted)] text-center py-2">
          {currentAnalysis ? '구간 정보 없음' : '곡 분석 후 구간이 표시됩니다'}
        </div>
      </div>
    );
  }

  const totalDuration = duration > 0 ? duration : sections[sections.length - 1]?.endTime ?? 1;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-4 py-3">
      {/* Color bar */}
      <div className="relative w-full h-2 bg-[var(--surface)] rounded overflow-hidden mb-2.5">
        {sections.map((section, i) => {
          const left = (section.startTime / totalDuration) * 100;
          const width = ((section.endTime - section.startTime) / totalDuration) * 100;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-80 ${i === activeSectionIndex ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]' : ''}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: SECTION_COLORS[section.type],
              }}
              onClick={() => handleSegmentClick(section)}
              title={`${section.label} (${formatTime(section.startTime)} ~ ${formatTime(section.endTime)})`}
            />
          );
        })}
      </div>

      {/* Tab list */}
      <div className="flex gap-1 flex-wrap">
        {sections.map((section, i) => (
          <button
            key={i}
            className={`px-2.5 py-1 border rounded-md text-xs cursor-pointer transition-all whitespace-nowrap select-none ${
              i === activeSectionIndex
                ? 'border-[var(--accent)] text-[var(--accent-lt)] bg-blue-500/[0.12] hover:bg-blue-500/[0.18]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
            }`}
            onClick={() => handleTabClick(section)}
            onDoubleClick={() => handleTabDoubleClick(section)}
            title={`클릭: 이동 | 더블클릭: 구간 반복\n${formatTime(section.startTime)} ~ ${formatTime(section.endTime)}`}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
              style={{ background: SECTION_DOT_COLORS[section.type] }}
            />
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
