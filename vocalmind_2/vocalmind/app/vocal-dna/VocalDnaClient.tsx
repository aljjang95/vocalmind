'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useVocalDnaStore } from '@/stores/vocalDnaStore';
import DnaCard from '@/components/vocal-dna/DnaCard';
import DnaShareButton from '@/components/vocal-dna/DnaShareButton';

const MIN_SEC = 5;
const MAX_SEC = 30;

interface VocalDnaClientProps {
  userName: string;
}

export default function VocalDnaClient({ userName }: VocalDnaClientProps) {
  const { dna, isAnalyzing, error, fetchDna, analyzeDna, getDnaAxes, clearError } =
    useVocalDnaStore();
  const axes = getDnaAxes();

  // 녹음 상태
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchDna();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startRecording = async () => {
    clearError();
    setAudioBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        cleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_SEC) {
            recorderRef.current?.stop();
            setIsRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      // MediaRecorder 오류는 store error 대신 직접 처리 (마이크 권한)
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyze = async () => {
    if (!audioBlob || elapsed < MIN_SEC) return;
    await analyzeDna(audioBlob);
    setAudioBlob(null);
    setElapsed(0);
  };

  const handleReanalyze = () => {
    setAudioBlob(null);
    setElapsed(0);
    clearError();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // DNA 있으면 카드 뷰
  if (dna && axes.length > 0 && !isAnalyzing) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* 페이지 헤더 */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '12px',
            }}
          >
            음색 DNA
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            나만의 목소리 지도
          </h1>
          <p
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--text-secondary)',
              marginTop: '10px',
            }}
          >
            5가지 긴장 축으로 그려낸 당신만의 음색 별자리입니다.
          </p>
        </div>

        {/* DNA 카드 */}
        <DnaCard
          dna={dna}
          axes={axes}
          userName={userName}
          onShare={() => setShowShareModal(true)}
          onReanalyze={handleReanalyze}
        />

        {/* 공유 모달 */}
        {showShareModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
            onClick={() => setShowShareModal(false)}
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 28px',
                maxWidth: '360px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.3rem',
                    color: 'var(--text-primary)',
                    margin: '0 0 8px',
                  }}
                >
                  음색 DNA 공유
                </h2>
                <p
                  style={{
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  1080×1350 PNG 이미지로 다운로드하거나 클립보드에 복사할 수 있습니다.
                </p>
              </div>

              <DnaShareButton
                axes={axes}
                dna={dna}
                userName={userName}
              />

              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 분석 날짜 */}
        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          마지막 분석:{' '}
          {new Date(dna.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
    );
  }

  // DNA 없음 — 녹음 UI
  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
      }}
    >
      {/* 페이지 헤더 */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '12px',
          }}
        >
          음색 DNA
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          나만의 음색 별자리를<br />발견하세요
        </h1>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-secondary)',
            marginTop: '12px',
            lineHeight: 1.7,
          }}
        >
          5~30초 노래를 불러주세요. AI가 후두·혀뿌리·턱·성구전환·음색안정 5축을 분석하여
          당신만의 음색 DNA 카드를 만들어드립니다.
        </p>
      </div>

      {/* 분석 중 스피너 */}
      {isAnalyzing && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '48px 0',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
            음색 분석 중... 잠시만 기다려주세요
          </p>
        </div>
      )}

      {/* 에러 표시 */}
      {error && !isAnalyzing && (
        <div
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'var(--error-muted)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--error)',
            fontSize: 'var(--fs-sm)',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* 녹음 UI */}
      {!isAnalyzing && (
        <>
          {/* 안내 배너 */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              color: '#F59E0B',
              fontSize: 'var(--fs-xs)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M8 1.5l6.5 12H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 6.5v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            조용한 환경에서 녹음하면 더 정확한 분석 결과를 얻을 수 있습니다.
          </div>

          {/* 녹음 버튼 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
              aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                border: `3px solid ${isRecording ? 'var(--error)' : 'var(--border-strong)'}`,
                background: isRecording ? 'rgba(244,63,94,0.1)' : 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                animation: isRecording ? 'recPulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              <div
                style={{
                  width: isRecording ? '24px' : '32px',
                  height: isRecording ? '24px' : '32px',
                  borderRadius: isRecording ? '4px' : '50%',
                  background: 'var(--error)',
                  transition: 'all 0.2s',
                }}
              />
            </button>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                fontWeight: 600,
                color: isRecording ? 'var(--error)' : 'var(--text-secondary)',
                minWidth: '60px',
                textAlign: 'center',
              }}
            >
              {formatTime(elapsed)}
            </span>

            {isRecording && (
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}
              >
                {elapsed < MIN_SEC
                  ? `${MIN_SEC - elapsed}초 더 녹음해주세요`
                  : '중지 버튼을 눌러 완료하세요'}
              </span>
            )}
          </div>

          {/* 녹음 완료 후 분석 버튼 */}
          {audioBlob && !isRecording && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--accent-light)',
                  textAlign: 'center',
                }}
              >
                녹음 완료 ({elapsed}초) — 분석 준비됨
              </p>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={elapsed < MIN_SEC}
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  padding: '14px 0',
                  background: elapsed >= MIN_SEC ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: elapsed >= MIN_SEC ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-body)',
                  fontWeight: 600,
                  cursor: elapsed >= MIN_SEC ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s, color 0.2s',
                  boxShadow: elapsed >= MIN_SEC
                    ? '0 6px 24px var(--accent-glow)'
                    : 'none',
                }}
              >
                음색 DNA 분석 시작
              </button>
            </div>
          )}
        </>
      )}

      {/* 하단 설명 */}
      {!isAnalyzing && !audioBlob && (
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          {[
            { label: '후두', desc: '성대 긴장도' },
            { label: '혀뿌리', desc: '발음 공간' },
            { label: '턱', desc: '개구 자유도' },
            { label: '성구전환', desc: '음역 연결' },
            { label: '음색안정', desc: '소리의 순도' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  color: 'var(--dna-star)',
                  margin: '0 0 4px',
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
