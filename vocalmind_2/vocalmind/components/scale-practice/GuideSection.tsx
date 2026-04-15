'use client';

import { useState } from 'react';

interface Props {
  videoId: string | null;
  instructions: string[];
  stageName: string;
}

export default function GuideSection({ videoId, instructions, stageName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid rgba(255,255,255,0.06)',
      transition: 'all 0.3s ease',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 16px', backgroundColor: 'transparent', border: 'none',
          color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', textAlign: 'left' as const,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 14,
            background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.05))',
          }}>📝</span>
          <span style={{ fontWeight: 600 }}>{stageName} 연습 가이드</span>
        </span>
        <span style={{
          fontSize: 11, color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          transition: 'transform 0.3s',
          transform: open ? 'rotate(180deg)' : 'none',
        }}>▼</span>
      </button>

      <div style={{
        maxHeight: open ? 500 : 0, overflow: 'hidden',
        transition: 'max-height 0.4s ease, opacity 0.3s ease',
        opacity: open ? 1 : 0,
      }}>
        <div style={{ padding: '0 16px 16px' }}>
          {videoId && (
            <div style={{
              position: 'relative', paddingBottom: '56.25%', height: 0,
              marginBottom: 14, borderRadius: 10, overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                allowFullScreen
              />
            </div>
          )}

          {instructions.length > 0 && (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {instructions.map((text, i) => (
                <li key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '8px 0',
                  borderBottom: i < instructions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(217,119,6,0.3), rgba(217,119,6,0.1))',
                    color: '#fbbf24',
                  }}>{i + 1}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{text}</span>
                </li>
              ))}
            </ol>
          )}

          {!videoId && instructions.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' as const, padding: '12px 0' }}>
              이 단계의 가이드가 준비 중입니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
