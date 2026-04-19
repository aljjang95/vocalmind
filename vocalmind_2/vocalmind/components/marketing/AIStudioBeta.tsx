'use client';

import Image from 'next/image';
import Link from 'next/link';
import { GlowCard } from '@/components/ui/glow-card';

const STEPS = [
  {
    num: '01',
    title: '내 목소리 등록',
    desc: '10문장만 녹음하면 AI가 당신의 음색을 학습합니다.',
    img: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&q=80',
    imgAlt: '마이크 앞에서 녹음하는 모습',
  },
  {
    num: '02',
    title: 'MR 업로드 + 녹음',
    desc: '좋아하는 반주에 맞춰 한 번만 불러주세요. 분리·튜닝 전부 자동입니다.',
    img: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&q=80',
    imgAlt: '헤드폰 낀 보컬리스트',
  },
  {
    num: '03',
    title: 'AI가 뮤직비디오로',
    desc: '시네마틱·포근·네온 레트로·지브리·네온 시티·판타지 6가지 스타일 중 선택 → 15분 내 완성 영상 다운로드.',
    img: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=600&q=80',
    imgAlt: '영상 편집 화면',
  },
];

export default function AIStudioBeta() {
  return (
    <section
      id="studio-beta"
      className="border-t border-white/[0.06] py-24"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52,211,153,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(91,140,110,0.05) 0%, transparent 60%)',
      }}
    >
      <div className="mx-auto max-w-[1200px] px-7">
        {/* 베타 뱃지 + 헤더 */}
        <div className="section-head center reveal">
          <div className="section-kicker flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            NEW · BETA
          </div>
          <h2 className="section-title">
            내 목소리로 <em>뮤직비디오</em>를 만드세요
          </h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            AI 스튜디오 베타가 열렸습니다. 가입 후 내 음색을 등록하면,
            <br />
            좋아하는 노래를 나만의 버전으로 재탄생시킬 수 있어요.
          </p>
        </div>

        {/* 3단계 카드 */}
        <div className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <GlowCard key={step.num} className="overflow-hidden">
              <div className="relative h-[180px] w-full overflow-hidden">
                <Image
                  src={step.img}
                  alt={step.imgAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  loading="lazy"
                  className="object-cover brightness-[0.55] saturate-[0.85]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)]/80 to-transparent" />
                <div className="absolute left-5 top-5 font-mono text-xs font-semibold text-emerald-300/90">
                  {step.num}
                </div>
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
              </div>
            </GlowCard>
          ))}
        </div>

        {/* 가격 + CTA */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-transparent p-10 md:p-12">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-200">
                  월 정액 없음
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-200">
                  C2PA 워터마크
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-200">
                  16:9 / 9:16 동시
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white md:text-3xl">
                커버 1편 <span className="text-emerald-300">3,000원부터</span>
              </h3>
              <p className="mt-2 max-w-[460px] text-sm text-white/60">
                선불 크레딧 결제 · 쓴 만큼만 차감 · 잔액은 탈퇴 전까지 만료 없음.
                <br />
                본인이 준비한 MR만 업로드해 라이선스 이슈에서 자유로워요.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
              >
                AI 스튜디오 체험 →
              </Link>
              <p className="text-[11px] text-white/40">
                품질 티어 3종 · 실패 시 자동 환불
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
