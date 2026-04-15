'use client';

import { useState } from 'react';
import type { DnaAxis, VocalDna } from '@/types';
import { renderDnaShareCard } from '@/lib/canvas/dnaShareRenderer';

interface DnaShareButtonProps {
  axes: DnaAxis[];
  dna: VocalDna;
  userName?: string;
  className?: string;
}

type ShareState = 'idle' | 'generating' | 'done' | 'error';

export default function DnaShareButton({
  axes,
  dna,
  userName = '보컬리스트',
  className,
}: DnaShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');
  const [copied, setCopied] = useState(false);

  const generateImage = (): HTMLCanvasElement => {
    return renderDnaShareCard(
      axes,
      userName,
      dna.voice_type,
      dna.avg_pitch_hz,
    );
  };

  const handleDownload = async () => {
    setState('generating');
    try {
      const canvas = generateImage();
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `vocal-dna-${userName.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      // 클립보드 API 미지원 시 다운로드로 폴백
      await handleDownload();
      return;
    }

    setState('generating');
    try {
      const canvas = generateImage();
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('이미지 변환 실패'));
        }, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);

      setState('done');
      setCopied(true);
      setTimeout(() => {
        setState('idle');
        setCopied(false);
      }, 2000);
    } catch {
      // 클립보드 실패 시 다운로드로 폴백
      await handleDownload();
    }
  };

  const isDisabled = state === 'generating';

  const labelMap: Record<ShareState, string> = {
    idle: '공유 이미지 다운로드',
    generating: '생성 중...',
    done: copied ? '클립보드에 복사됨' : '다운로드 완료',
    error: '오류 발생',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
      className={className}
    >
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDisabled}
        style={{
          padding: '12px 20px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {state === 'generating' ? '이미지 생성 중...' : '이미지 다운로드'}
      </button>

      <button
        type="button"
        onClick={handleCopyToClipboard}
        disabled={isDisabled}
        style={{
          padding: '12px 20px',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 500,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          transition: 'opacity 0.2s, background 0.2s',
        }}
      >
        {copied ? '클립보드에 복사됨' : '클립보드에 복사'}
      </button>

      {state === 'error' && (
        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--error)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          이미지 생성에 실패했습니다.
        </p>
      )}

      <p
        style={{
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {labelMap[state]}
      </p>
    </div>
  );
}
