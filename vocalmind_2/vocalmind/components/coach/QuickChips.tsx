'use client';

const QUICK_QUESTIONS = [
  '고음을 편하게 내는 법',
  '호흡 훈련 방법',
  '음정이 자꾸 틀려요',
  '발음 교정하고 싶어요',
  '오디션 준비 도움',
  '복식호흡 연습법',
];

interface QuickChipsProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function QuickChips({ onSelect, disabled }: QuickChipsProps) {
  return (
    <div className="px-[18px] pt-2.5 pb-4 flex gap-[7px] flex-wrap">
      {QUICK_QUESTIONS.map((q) => (
        <button
          key={q}
          className="px-[13px] py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-full text-xs text-[var(--text2)] cursor-pointer font-['Inter','Noto_Sans_KR',sans-serif] transition-all duration-200 hover:enabled:bg-[rgba(59,130,246,0.12)] hover:enabled:text-[var(--text)] hover:enabled:border-[rgba(59,130,246,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onSelect(q)}
          disabled={disabled}
          type="button"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
