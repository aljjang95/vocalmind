'use client';

import { useState } from 'react';

interface CopyrightAgreementProps {
  onAgree: () => void;
  context: 'community' | 'audition' | 'ai-cover';
}

const CONTEXT_TEXT = {
  community: {
    title: '커버곡 공유 안내',
    items: [
      '업로드하는 음원의 저작권/초상권은 본인에게 있음을 확인합니다.',
      '본 콘텐츠는 회원 간 비공개 공유이며, 외부 유출을 금지합니다.',
      '개인 보컬 연습 및 피드백 목적으로만 사용됩니다.',
    ],
  },
  audition: {
    title: '오디션 참가 안내',
    items: [
      '오디션 지정곡은 저작권 프리 곡 또는 플랫폼 제공 곡입니다.',
      '참가 녹음은 회원 간 비공개 공유이며, 외부 유출을 금지합니다.',
      '투표 결과에 따른 보상은 플랫폼 내 아이템으로 제공됩니다.',
    ],
  },
  'ai-cover': {
    title: 'AI 커버 이용 안내',
    items: [
      '업로드하는 음원의 저작권은 본인에게 있음을 확인합니다.',
      'AI 변환 결과물은 개인 연습 목적이며, 상업적 사용을 금지합니다.',
      '변환 결과물은 플랫폼 내에서만 재생 가능합니다.',
    ],
  },
};

export default function CopyrightAgreement({ onAgree, context }: CopyrightAgreementProps) {
  const [checked, setChecked] = useState(false);
  const text = CONTEXT_TEXT[context];

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '16px',
      }}
    >
      <h4
        style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          marginBottom: '12px',
        }}
      >
        {text.title}
      </h4>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {text.items.map((item, i) => (
          <li
            key={i}
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-xs)',
              lineHeight: 1.5,
              paddingLeft: '12px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text-muted)',
              }}
            >
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-primary)',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        위 내용을 확인하고 동의합니다
      </label>
      <button
        onClick={onAgree}
        disabled={!checked}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '10px',
          background: checked ? 'var(--accent)' : 'var(--bg-hover)',
          color: checked ? '#fff' : 'var(--text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: checked ? 'pointer' : 'not-allowed',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          transition: 'background 0.2s',
        }}
      >
        동의하고 계속하기
      </button>
    </div>
  );
}
