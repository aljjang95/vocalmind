'use client';

import Link from 'next/link';
import AudioPlayer from '@/components/ai-cover/AudioPlayer';

const DEMO_SAMPLES = [
  {
    title: '발라드 데모',
    original: '/audio/demo-original-1.wav',
    converted: '/audio/demo-converted-1.wav',
  },
  {
    title: '팝 데모',
    original: '/audio/demo-original-2.wav',
    converted: '/audio/demo-converted-2.wav',
  },
];

export default function DemoSection() {
  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <div className="text-center pt-12 pb-8 max-sm:pt-8 max-sm:pb-6">
        <h1 className="text-[2.25rem] max-sm:text-[1.75rem] font-extrabold text-[var(--text-primary)] leading-[1.2] mb-3">
          AI로 내 목소리가
          <br />
          <span className="text-purple-600">이렇게!</span>
        </h1>
        <p className="text-base text-[var(--text-secondary)] max-w-[400px] mx-auto">
          AI 음성 변환 기술로 좋아하는 노래를 내 목소리로 불러보세요.
        </p>
      </div>

      <div className="flex flex-col gap-5 mb-8">
        {DEMO_SAMPLES.map((sample) => (
          <div key={sample.title} className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">{sample.title}</h3>
            <AudioPlayer
              src={sample.converted}
              compareSrc={sample.original}
              label="원본"
              compareLabel="AI 커버"
            />
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-purple-600/15 to-purple-600/5 border border-purple-600/30 rounded-xl p-8 text-center">
        <p className="text-[1.05rem] text-[var(--text-primary)] mb-5">
          가입하면 내 목소리로 체험할 수 있습니다
        </p>
        <Link href="/onboarding" className="inline-block py-3 px-8 bg-purple-600 text-white text-base font-semibold rounded-xl no-underline hover:opacity-90 transition-opacity">
          무료 상담 시작하기
        </Link>
      </div>
    </div>
  );
}
