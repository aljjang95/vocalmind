'use client';

import { useState } from 'react';
import Link from 'next/link';
import ChatBox from '@/components/coach/ChatBox';
import { IconMic, IconChat, IconTarget } from '@/components/shared/Icons';
import { GlowCard } from '@/components/ui/glow-card';

/* ── 4축 긴장 분석 시뮬레이션 ── */
const TENSION_AXES = [
  { label: '후두 긴장',   score: 72, level: 'high',   feedback: '후두가 많이 올라와 있어요. 혀를 먼저 내려보내면 자연스럽게 안정됩니다.' },
  { label: '혀뿌리 긴장', score: 31, level: 'low',    feedback: '혀뿌리는 비교적 편안한 상태예요.' },
  { label: '턱 긴장',     score: 48, level: 'medium', feedback: '턱에 약간의 힘이 들어가 있어요. 입을 자연스럽게 열어보세요.' },
  { label: '성구전환',    score: 58, level: 'medium', feedback: '전환점에서 소리가 약간 흔들립니다.' },
];

const LEVEL_COLOR: Record<string, string> = {
  high: 'var(--error)',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

const LEVEL_BG: Record<string, string> = {
  high: 'var(--error-muted)',
  medium: 'var(--warning-muted)',
  low: 'var(--success-muted)',
};

const LEVEL_LABEL: Record<string, string> = {
  high: '주의',
  medium: '보통',
  low: '양호',
};

function TensionDemo() {
  const worst = TENSION_AXES.reduce((a, b) => a.score > b.score ? a : b);

  return (
    <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col gap-5">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--error)] bg-[var(--error-muted)] px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)] animate-pulse" />
          분석 완료 — 후두 긴장 감지됨
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {TENSION_AXES.map((ax) => (
          <div key={ax.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] font-medium text-[var(--text-secondary)]">{ax.label}</span>
              <span className="text-[0.7rem] font-bold tracking-wider" style={{ color: LEVEL_COLOR[ax.level] }}>
                {LEVEL_LABEL[ax.level]}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg-elevated)] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-[width] duration-1000"
                style={{
                  width: `${ax.score}%`,
                  background: LEVEL_COLOR[ax.level],
                  boxShadow: `0 0 8px ${LEVEL_BG[ax.level]}`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-4 py-3.5 flex flex-col gap-1.5">
        <span className="text-[0.68rem] font-bold tracking-widest uppercase text-[var(--accent)]">AI 코치</span>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic">
          &ldquo;{worst.feedback} 지금 목 안쪽이 좁게 느껴지나요? 혀를 먼저 내려보내는 연습을 해봐요.&rdquo;
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 pt-1">
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center w-full px-5 py-3 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg no-underline transition-all hover:bg-[var(--accent-hover)] hover:-translate-y-px"
        >
          내 긴장 분석 받기
        </Link>
        <span className="text-[0.72rem] text-[var(--text-muted)]">녹음 30초면 결과가 나옵니다</span>
      </div>
    </div>
  );
}

/* ── Demo 탭 ── */
const TABS = [
  { id: 'chat', icon: <IconChat size={16} />, label: 'AI 코치 체험' },
  { id: 'tension', icon: <IconMic size={16} />, label: '4축 긴장 분석' },
];

export default function Demo() {
  const [tab, setTab] = useState<'chat' | 'tension'>('tension');

  return (
    <section id="demo" className="py-24">
      <div className="max-w-[1200px] mx-auto px-7">
        <div className="text-center mb-10 reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>직접 확인</div>
          <h2 className="font-[family-name:var(--font-display)] text-[var(--fs-h2)] text-[var(--text-primary)] text-center mb-8">
            실제로 어떻게 작동하는지
          </h2>
          <p className="text-base text-[var(--text-secondary)] text-center mt-3 max-w-[480px] mx-auto leading-relaxed">
            녹음하면 4축 긴장이 수치로 나옵니다. AI 코치는 원인과 해결 방법을 바로 알려줍니다.
          </p>
        </div>

        {/* 탭 */}
        <div className="flex justify-center gap-2 mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border cursor-pointer transition-all font-[family-name:var(--font-sans)] ${
                tab === t.id
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => setTab(t.id as 'chat' | 'tension')}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <GlowCard className="p-10 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div className="reveal">
              {tab === 'chat' ? <ChatBox /> : <TensionDemo />}
            </div>

            <div className="flex flex-col gap-3.5 reveal">
              {tab === 'tension' ? (
                <>
                  <div className="flex gap-3.5 items-start p-4 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl transition-all hover:border-[var(--border-default)] hover:translate-x-1">
                    <div className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                      <IconMic size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1 tracking-tight">왜 목이 조이는지 알려줍니다</div>
                      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        일반 앱은 &quot;음정이 틀렸어요&quot;까지만 말해요. HLB는 <strong>후두가 올라가서</strong> 음정이 틀렸다고 알려줍니다.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3.5 items-start p-4 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl transition-all hover:border-[var(--border-default)] hover:translate-x-1">
                    <div className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(91,140,110,0.12)' }}>
                      <IconTarget size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1 tracking-tight">4부위를 동시에 분석</div>
                      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        후두·혀뿌리·턱·성구전환을 한 번의 녹음으로 측정합니다. 어디서 힘을 빼야 하는지 바로 보입니다.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3.5 items-start p-4 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl transition-all hover:border-[var(--border-default)] hover:translate-x-1">
                    <div className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                      <IconChat size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1 tracking-tight">감각 언어로 설명</div>
                      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        &quot;Jitter 수치가 0.8%&quot;가 아니라 &quot;목 안쪽이 좁게 느껴지나요?&quot;처럼 실제로 느낄 수 있는 말로 전달합니다.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-3.5 items-start p-4 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl transition-all hover:border-[var(--border-default)] hover:translate-x-1">
                    <div className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(91,140,110,0.12)' }}>
                      <IconChat size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1 tracking-tight">실제 AI가 답합니다</div>
                      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        미리 만든 답변이 아닙니다. 7년 트레이너 커리큘럼을 학습한 AI가 맞춤 답변을 생성합니다.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3.5 items-start p-4 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl transition-all hover:border-[var(--border-default)] hover:translate-x-1">
                    <div className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                      <IconTarget size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1 tracking-tight">즉각적인 피드백</div>
                      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        레슨 예약도, 대기도 없습니다. 지금 궁금한 것을 바로 물어보세요.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </GlowCard>
      </div>
    </section>
  );
}
