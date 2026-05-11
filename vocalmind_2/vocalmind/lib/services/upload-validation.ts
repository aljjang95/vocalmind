const AUDIO_EXTENSIONS = new Set(['webm', 'wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac']);

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function validateAudioFile(
  file: File,
  options: { maxBytes: number; label?: string },
): FileValidationResult {
  const label = options.label ?? '오디오 파일';

  if (file.size <= 0) {
    return { ok: false, error: `${label}이 비어 있습니다.`, code: 'EMPTY_FILE' };
  }

  if (file.size > options.maxBytes) {
    return {
      ok: false,
      error: `${label}은 ${formatMegabytes(options.maxBytes)} 이하만 업로드할 수 있습니다.`,
      code: 'FILE_TOO_LARGE',
    };
  }

  if (!isAllowedAudioFile(file)) {
    return {
      ok: false,
      error: '지원하지 않는 오디오 형식입니다. webm, wav, mp3, m4a, ogg, flac 파일을 사용해주세요.',
      code: 'INVALID_AUDIO_TYPE',
    };
  }

  return { ok: true };
}

export function getSafeAudioExtension(file: File, fallback = 'webm'): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && AUDIO_EXTENSIONS.has(fromName)) return fromName;

  const fromType = file.type.split('/').pop()?.toLowerCase();
  if (fromType && AUDIO_EXTENSIONS.has(fromType)) return fromType;

  return fallback;
}

function isAllowedAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;

  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && AUDIO_EXTENSIONS.has(ext);
}

function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))}MB`;
}
