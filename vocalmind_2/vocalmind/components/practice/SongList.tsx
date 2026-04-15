'use client';

import { useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { deleteBlob } from '@/lib/storage/songDB';
import type { Song } from '@/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
}

function getSeparationLabel(status: Song['separationStatus']): { text: string; cls: string } {
  switch (status) {
    case 'pending':
      return { text: '분리 중', cls: 'bg-yellow-500/[0.15] text-[var(--warning)]' };
    case 'failed':
      return { text: '분리 실패', cls: 'bg-red-500/[0.12] text-[var(--error)]' };
    case 'done':
      return { text: '분리 완료', cls: 'bg-green-500/[0.12] text-[var(--success)]' };
    default:
      return { text: '분리 완료', cls: 'bg-green-500/[0.12] text-[var(--success)]' };
  }
}

function getAnalysisLabel(status: Song['analysisStatus']): { text: string; cls: string } | null {
  switch (status) {
    case 'analyzing':
      return { text: '분석 중', cls: 'bg-yellow-500/[0.15] text-[var(--warning)]' };
    case 'done':
      return { text: '분석 완료', cls: 'bg-green-500/[0.12] text-[var(--success)]' };
    default:
      return null;
  }
}

export default function SongList() {
  const { songs, currentSongId, setCurrentSong, removeSong } = usePracticeStore();
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteBlob(deleteTarget.vocalBlobKey);
      if (deleteTarget.instrumentalBlobKey !== deleteTarget.vocalBlobKey) {
        await deleteBlob(deleteTarget.instrumentalBlobKey);
      }
      if (deleteTarget.originalBlobKey) {
        await deleteBlob(deleteTarget.originalBlobKey);
      }
      removeSong(deleteTarget.id);
    } catch {
      // IndexedDB cleanup failure is non-critical
    }
    setDeleteTarget(null);
  }, [deleteTarget, removeSong]);

  const handleSongClick = useCallback((song: Song) => {
    setCurrentSong(song.id);
  }, [setCurrentSong]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text)]">내 곡 목록</h2>
        <span className="text-xs text-[var(--muted)] font-medium">{songs.length}곡</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-3">
            <div className="text-2xl opacity-30">&#9835;</div>
            <p className="text-[var(--text2)] text-sm leading-relaxed">
              아직 추가된 곡이 없습니다.<br />
              우측 상단에서 곡을 업로드해주세요.
            </p>
          </div>
        ) : (
          songs.map((song) => {
            const sepBadge = getSeparationLabel(song.separationStatus);
            const anaBadge = getAnalysisLabel(song.analysisStatus);

            return (
              <div
                key={song.id}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-md cursor-pointer transition-colors border ${
                  currentSongId === song.id
                    ? 'bg-[var(--surface2)] border-[var(--accent)]'
                    : 'border-transparent hover:bg-[var(--surface)]'
                }`}
                onClick={() => handleSongClick(song)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] whitespace-nowrap overflow-hidden text-ellipsis">{song.title}</div>
                  <div className="flex gap-2 items-center mt-0.5">
                    <span className="text-xs text-[var(--text2)] whitespace-nowrap overflow-hidden text-ellipsis">{song.artist}</span>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">{formatDuration(song.durationSec)}</span>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">{formatDate(song.addedAt)}</span>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-semibold tracking-tight ${sepBadge.cls}`}>
                      {sepBadge.text}
                    </span>
                    {anaBadge && (
                      <span className={`inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-semibold tracking-tight ${anaBadge.cls}`}>
                        {anaBadge.text}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="shrink-0 w-7 h-7 flex items-center justify-center bg-transparent border border-transparent rounded-md text-[var(--muted)] cursor-pointer text-sm transition-all hover:text-[var(--error)] hover:bg-red-500/10 hover:border-red-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(song);
                  }}
                  aria-label={`${song.title} 삭제`}
                >
                  &#10005;
                </button>
              </div>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[var(--bg2)] border border-[var(--border2)] rounded-xl p-6 max-w-[360px] w-[90%]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-[var(--text)] mb-5 leading-relaxed">
              <strong>{deleteTarget.title}</strong> 곡을 삭제하시겠습니까?<br />
              삭제된 곡은 복구할 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] rounded-md text-sm cursor-pointer transition-colors hover:bg-[var(--surface3)]" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button className="px-4 py-2 bg-[var(--error)] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90" onClick={handleDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
