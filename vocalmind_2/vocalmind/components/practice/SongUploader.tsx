'use client';

import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { saveBlob, getBlob } from '@/lib/storage/songDB';

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/flac', 'audio/x-flac'];
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.flac'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_SONGS = 10;

function isValidAudioFile(file: File): boolean {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
}

function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => URL.revokeObjectURL(url);
    const timeout = setTimeout(() => {
      cleanup();
      resolve(0); // 메타데이터 읽기 실패 시 0으로 fallback
    }, 5000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      cleanup();
      const dur = isFinite(audio.duration) ? audio.duration : 0;
      resolve(dur);
    };
    audio.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(0); // 에러 시 0으로 fallback (업로드는 계속 진행)
    };
    audio.src = url;
  });
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function SongUploader({ collapsed, onToggle }: Props) {
  const { songs, addSong, updateSong } = usePracticeStore();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [separatingId, setSeparatingId] = useState<string | null>(null);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [separationError, setSeparationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const separationAbortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (separationAbortRef.current) {
        separationAbortRef.current.abort();
      }
    };
  }, []);

  const validateFile = useCallback((f: File): string | null => {
    if (!isValidAudioFile(f)) {
      return `지원하지 않는 파일 형식입니다. (${ACCEPTED_EXTENSIONS.join(', ')})`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return '파일 크기가 50MB를 초과합니다.';
    }
    return null;
  }, []);

  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    const err = validateFile(droppedFile);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(droppedFile);
  }, [validateFile]);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const err = validateFile(selectedFile);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(selectedFile);
  }, [validateFile]);

  const startSeparation = useCallback(async (songId: string) => {
    setSeparatingId(songId);
    setSeparationProgress(0);
    setSeparationError(null);

    const abortController = new AbortController();
    separationAbortRef.current = abortController;

    try {
      const originalBlob = await getBlob(`${songId}-original`);
      if (!originalBlob) {
        throw new Error('원본 파일을 찾을 수 없습니다.');
      }

      setSeparationProgress(10);

      const formData = new FormData();
      formData.append('audio', originalBlob);

      setSeparationProgress(20);

      const response = await fetch('/api/separate', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      setSeparationProgress(60);

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '보컬 분리 실패' }));
        throw new Error(data.error || '보컬 분리 처리 중 오류가 발생했습니다.');
      }

      const result = await response.json();
      setSeparationProgress(80);

      // Save separated vocal and instrumental blobs
      if (result.vocal && result.instrumental) {
        const vocalResponse = await fetch(result.vocal);
        const vocalBlob = await vocalResponse.blob();
        await saveBlob(`${songId}-vocal`, vocalBlob);

        const instrumentalResponse = await fetch(result.instrumental);
        const instrumentalBlob = await instrumentalResponse.blob();
        await saveBlob(`${songId}-mr`, instrumentalBlob);

        updateSong(songId, {
          separationStatus: 'done',
          vocalBlobKey: `${songId}-vocal`,
          instrumentalBlobKey: `${songId}-mr`,
        });
      } else {
        // If API returns without separate tracks, treat original as both
        updateSong(songId, {
          separationStatus: 'done',
        });
      }

      setSeparationProgress(100);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : '보컬 분리 실패';
      setSeparationError(msg);
      updateSong(songId, { separationStatus: 'failed' });
    } finally {
      separationAbortRef.current = null;
      // Clear progress after a short delay if successful
      setTimeout(() => {
        setSeparatingId((prev) => {
          if (prev === songId) {
            setSeparationProgress(0);
            return null;
          }
          return prev;
        });
      }, 1500);
    }
  }, [updateSong]);

  const handleRetrySeparation = useCallback(() => {
    if (!separatingId) return;
    setSeparationError(null);
    updateSong(separatingId, { separationStatus: 'pending' });
    startSeparation(separatingId);
  }, [separatingId, updateSong, startSeparation]);

  const handleAdd = useCallback(async () => {
    setError(null);

    if (songs.length >= MAX_SONGS) {
      setError(`최대 ${MAX_SONGS}곡까지 추가할 수 있습니다.`);
      return;
    }

    if (!title.trim()) {
      setError('곡 제목을 입력해주세요.');
      return;
    }

    if (!file) {
      setError('오디오 파일을 업로드해주세요.');
      return;
    }

    setIsAdding(true);

    try {
      const songId = `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const origKey = `${songId}-original`;

      await saveBlob(origKey, file);
      const durationSec = await getAudioDuration(file);

      addSong({
        id: songId,
        title: title.trim(),
        artist: artist.trim() || '알 수 없음',
        addedAt: new Date().toISOString(),
        vocalBlobKey: origKey,
        instrumentalBlobKey: origKey,
        originalBlobKey: origKey,
        durationSec: Math.round(durationSec),
        separationStatus: 'pending',
        analysisStatus: 'none',
      });

      // Reset form
      setFile(null);
      setTitle('');
      setArtist('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Start separation in background
      startSeparation(songId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '곡 추가 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setIsAdding(false);
    }
  }, [songs.length, title, artist, file, addSong, startSeparation]);

  const canAdd = !!(file && title.trim());

  if (collapsed) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-[var(--text)]">곡 업로드</span>
          <button className="bg-transparent border border-[var(--border2)] text-[var(--text2)] text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]" onClick={onToggle}>펼치기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-bold text-[var(--text)]">곡 업로드</span>
        <button className="bg-transparent border border-[var(--border2)] text-[var(--text2)] text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]" onClick={onToggle}>접기</button>
      </div>

      <div
        className={`${"border-2 border-dashed border-[var(--border2)] rounded-lg px-4 py-8 text-center cursor-pointer transition-all relative mb-4 hover:border-[var(--accent)] hover:bg-blue-500/[0.04]"} ${dragOver ? "border-[var(--accent)] bg-blue-500/[0.08]" : ''} ${file ? "border-[var(--success)] border-solid bg-green-500/[0.05]" : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <>
            <span className="block text-sm font-semibold text-[var(--text2)] mb-1.5">선택된 파일</span>
            <div className="text-sm text-[var(--success)] mt-1 mb-1 break-all">{file.name}</div>
            <span className="text-xs text-[var(--muted)]">
              {(file.size / (1024 * 1024)).toFixed(1)}MB
            </span>
          </>
        ) : (
          <>
            <span className="block text-[1.8rem] opacity-30 mb-2">&#9835;</span>
            <span className="block text-sm font-semibold text-[var(--text2)] mb-1.5">
              오디오 파일을 끌어다 놓거나 클릭하여 선택
            </span>
            <span className="text-xs text-[var(--muted)]">
              {ACCEPTED_EXTENSIONS.join(', ')} / 최대 50MB
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 max-sm:grid-cols-1">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text2)] font-medium">곡 제목 *</label>
          <input
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="곡 제목을 입력하세요"
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text2)] font-medium">아티스트</label>
          <input
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="아티스트 이름 (선택)"
            maxLength={100}
          />
        </div>
      </div>

      {error && <p className="text-[var(--error)] text-xs mb-2">{error}</p>}

      <button
        className="w-full py-2.5 bg-[var(--accent)] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleAdd}
        disabled={!canAdd || isAdding}
      >
        {isAdding ? '추가 중...' : `업로드 (${songs.length}/${MAX_SONGS})`}
      </button>

      {/* Separation progress inline */}
      {separatingId && !separationError && (
        <div className="mt-3 p-3 bg-[var(--surface)] rounded-md">
          <div className="text-xs text-[var(--accent-lt)] font-medium mb-2">
            보컬/MR 분리 중... {separationProgress}%
          </div>
          <div className="h-1 bg-[var(--surface2)] rounded-sm overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-300"
              style={{ width: `${separationProgress}%` }}
            />
          </div>
        </div>
      )}

      {separationError && (
        <div className="mt-3 p-3 bg-red-500/[0.08] border border-red-500/20 rounded-md flex items-center justify-between gap-3 text-xs text-[var(--error-lt)]">
          <span>{separationError}</span>
          <button className="shrink-0 px-3 py-1.5 bg-[var(--error)] text-white border-none rounded-md text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90" onClick={handleRetrySeparation}>
            다시 시도
          </button>
        </div>
      )}

      <div className="bg-[var(--surface)] rounded-md p-3 text-center text-[var(--muted)] text-xs mt-3 leading-relaxed">
        업로드 후 자동으로 보컬/MR 분리가 진행됩니다. 분리 중에도 원본으로 재생 가능합니다.
      </div>
    </div>
  );
}
