'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
const ACCEPT_STRING = ACCEPTED_TYPES.join(',');
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropZone({ onFileSelected, disabled = false }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setError(`지원하지 않는 형식입니다. (${ACCEPTED_TYPES.join(', ')})`);
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError(`파일 크기가 ${MAX_SIZE_MB}MB를 초과합니다.`);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect],
  );

  const handleClick = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      e.target.value = '';
    },
    [validateAndSelect],
  );

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-xl p-8 min-h-[200px] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-[var(--accent,#7c3aed)] bg-purple-600/[0.08]'
            : disabled
              ? 'border-[var(--border2,#3a3a4a)] bg-[var(--bg2,#111113)] opacity-50 cursor-not-allowed'
              : 'border-[var(--border2,#3a3a4a)] bg-[var(--bg2,#111113)] hover:border-[var(--accent,#7c3aed)] hover:bg-purple-600/[0.04]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isDragOver ? (
          <p className="text-base font-medium text-purple-300">여기에 놓으세요</p>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[2.5rem] opacity-30">&#127925;</span>
            <p className="text-sm text-green-500 break-all text-center">{selectedFile.name}</p>
            <p className="text-xs text-[var(--muted,#6b6b7b)]">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <>
            <span className="text-[2.5rem] opacity-30">&#128190;</span>
            <p className="text-sm font-semibold text-[var(--text2,#a3a3a3)]">파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-xs text-[var(--muted,#6b6b7b)]">
              WAV, MP3, FLAC, OGG, M4A / 최대 {MAX_SIZE_MB}MB
            </p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleInputChange}
        className="hidden"
      />
    </>
  );
}
