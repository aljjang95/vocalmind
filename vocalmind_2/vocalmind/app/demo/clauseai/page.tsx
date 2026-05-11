"use client";

import { motion, useScroll, useTransform, AnimatePresence, type Variants } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── 애니메이션 프리셋 ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [...EASE] } },
};
const stagger = (delay = 0.08): Variants => ({
  hidden: {},
  show:   { transition: { staggerChildren: delay } },
});
const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [...EASE] } },
};

/* ── 타이핑 데모 컴포넌트 ── */
const DEMO_SCENARIOS = [
  {
    q: "계약서 요약해줘",
    lines: [
      "• 자동 연장 조항 포함 (90일 전 해지 통보)",
      "• 위약금 3개월치 발생 가능",
      "• 독점 조항 포함 — 검토 권장",
    ],
    badge: "계약 분석",
  },
  {
    q: "이메일 초안 작성해줘",
    lines: [
      "제목: [중요] Q2 협력 제안 건",
      "안녕하세요 김 대리님,",
      "검토 후 회신 부탁드립니다 :)",
    ],
    badge: "이메일 작성",
  },
  {
    q: "리스크 분석해줘",
    lines: [
      "⚠ 계약 기간 모호 — 명확화 필요",
      "✓ 지식재산권 조항 표준 범위",
      "⚠ 손해배상 상한 없음 — 협상 권장",
    ],
    badge: "리스크 탐지",
  },
];

function TypingDemo() {
  const [idx, setIdx]     = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "showing" | "clearing">("typing");
  const query = DEMO_SCENARIOS[idx].q;

  useEffect(() => {
    if (phase === "typing") {
      if (typed.length < query.length) {
        const t = setTimeout(() => setTyped(query.slice(0, typed.length + 1)), 48);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("showing"), 380);
      return () => clearTimeout(t);
    }
    if (phase === "showing") {
      const t = setTimeout(() => setPhase("clearing"), 2900);
      return () => clearTimeout(t);
    }
    if (phase === "clearing") {
      const t = setTimeout(() => {
        setTyped("");
        setIdx((i) => (i + 1) % DEMO_SCENARIOS.length);
        setPhase("typing");
      }, 350);
      return () => clearTimeout(t);
    }
  }, [phase, typed, query]);

  const resp = DEMO_SCENARIOS[idx];

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/[0.09]"
      style={{
        background: "linear-gradient(145deg, rgba(18,26,20,0.92) 0%, rgba(12,18,14,0.92) 100%)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 0 60px rgba(80,180,120,0.07), 0 2px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* 맥 스타일 상단 바 */}
      <div
        className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]/70" />
        <span className="ml-3 text-[11px] text-white/25 font-mono tracking-wide">
          clauseai.kr — AI 분석 엔진
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* 입력 필드 */}
        <div className="flex gap-2.5 items-center">
          <div
            className="flex-1 rounded-xl px-4 py-3 text-[13px] text-white/75 font-mono min-h-[44px] flex items-center border border-white/[0.08]"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {typed}
            <span className="inline-block w-[2px] h-[14px] bg-[#6FAE8D] ml-0.5 animate-pulse rounded-full" />
          </div>
          <button
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #5B8C6E 0%, #3A6B50 100%)",
              boxShadow: "0 4px 16px rgba(91,140,110,0.35)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* AI 응답 패널 */}
        <AnimatePresence mode="wait">
          {phase === "showing" && (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="rounded-xl border border-[#5B8C6E]/20 p-4 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(28,42,32,0.7) 0%, rgba(20,30,24,0.7) 100%)" }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(111,174,141,0.35), transparent)" }}
              />
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #5B8C6E, #3A6B50)" }}
                >
                  AI
                </span>
                <span className="text-[11px] text-[#7DBF9E] font-medium">{resp.badge} 완료</span>
                <span className="ml-auto text-[10px] text-white/20">방금 전</span>
              </div>
              <ul className="space-y-1.5">
                {resp.lines.map((line, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.09, duration: 0.28 }}
                    className="text-[13px] text-white/65 leading-relaxed"
                  >
                    {line}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 빠른 선택 태그 */}
        <div className="flex gap-2 flex-wrap pt-0.5">
          {["계약서 요약", "리스크 분석", "조항 비교", "이메일 초안"].map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-[11px] border border-white/[0.07] text-white/30 cursor-pointer transition-all duration-200 hover:border-[#5B8C6E]/40 hover:text-[#7DBF9E]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 데이터 ── */
const USE_CASES = [
  { icon: "📄", label: "계약서 요약", desc: "복잡한 조항을 3줄로", tag: "가장 인기" },
  { icon: "✉️", label: "이메일 작성", desc: "맥락 이해하는 초안", tag: "업무 필수" },
  { icon: "📊", label: "보고서 생성", desc: "데이터에서 인사이트", tag: "신규" },
  { icon: "⚖️", label: "법률 검토", desc: "리스크 사전 감지", tag: "전문가 추천" },
];

const STATS = [
  { num: "80%", label: "평균 시간 절감" },
  { num: "10초", label: "계약서 분석 속도" },
  { num: "99.2%", label: "사용자 만족도" },
];

const BEFORE_ITEMS = [
  "20페이지 계약서 직접 정독",
  "중요 조항 놓칠 위험",
  "평균 4시간 검토 소요",
  "전문 법무 비용 추가",
];
const AFTER_ITEMS = [
  "10초 만에 핵심 조항 요약",
  "리스크 자동 감지 및 알림",
  "즉각적인 검토 완료",
  "비용 90% 절감",
];

const TESTIMONIALS = [
  { text: "이거 없으면 계약서 검토 못해요. 진짜 일하는 AI.", author: "스타트업 대표", role: "CEO", initial: "K" },
  { text: "시간이 80% 줄었어요. 팀 전체가 쓰고 있습니다.", author: "법무팀 매니저", role: "Manager", initial: "P" },
  { text: "AI 중에 제일 실용적입니다. 한국어도 완벽해요.", author: "프리랜서 컨설턴트", role: "Consultant", initial: "L" },
];

/* ── 메인 페이지 ── */
export default function ClauseAILanding() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <div
      className="min-h-screen overflow-x-hidden text-[#E6F1EB]"
      style={{
        background: "linear-gradient(180deg, #080E0B 0%, #0A0F0D 40%, #080E0B 100%)",
        fontFamily: "Inter, 'Noto Sans KR', -apple-system, sans-serif",
      }}
    >
      {/* ── Ambient background glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[-15%] left-[5%] w-[800px] h-[800px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(72,140,100,0.08) 0%, transparent 65%)" }}
        />
        <div
          className="absolute top-[40%] right-[-12%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(50,110,78,0.06) 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-[5%] left-[35%] w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(72,160,110,0.05) 0%, transparent 65%)" }}
        />
      </div>

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="sticky top-0 z-50 flex items-center justify-between px-10 py-4 border-b border-white/[0.06]"
        style={{
          background: "rgba(8,14,11,0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* 로고 */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #5B8C6E 0%, #3A6B50 100%)" }}
          >
            C
          </div>
          <span className="text-[14px] font-semibold tracking-wide text-white/85">clauseai.kr</span>
        </div>

        {/* 메뉴 */}
        <div className="flex items-center gap-7 text-[13px] text-white/35">
          {["AI 사용 사례", "가격", "가이드"].map((item) => (
            <span key={item} className="cursor-pointer hover:text-white/70 transition-colors duration-200">
              {item}
            </span>
          ))}
        </div>

        <button
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white/80 border border-white/[0.09] hover:border-[#5B8C6E]/45 hover:bg-[#5B8C6E]/8 hover:text-white transition-all duration-200"
          style={{ backdropFilter: "blur(8px)" }}
        >
          무료로 시작하기
        </button>
      </motion.nav>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative z-10 px-10 pt-20 pb-24 max-w-[1180px] mx-auto grid grid-cols-2 gap-16 items-center"
      >
        {/* LEFT */}
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#5B8C6E]/28 mb-8" style={{ background: "rgba(91,140,110,0.07)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6FAE8D] animate-pulse" />
            <span className="text-[11px] text-[#8FD1AD] font-medium tracking-wide">Beta — 지금 무료로 사용 가능</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-[50px] leading-[1.13] font-bold mb-6"
            style={{ fontFamily: "Crimson Pro, Georgia, serif", letterSpacing: "-0.025em" }}
          >
            복잡한 업무는<br />
            <span
              style={{
                background: "linear-gradient(135deg, #A8E8C8 0%, #6FAE8D 45%, #3A7A58 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AI에게 맡기세요
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-[15px] leading-[1.75] text-white/45 mb-10 max-w-[370px]">
            계약서 분석부터 이메일 작성까지.<br />
            ClauseAI가 당신의 시간을 아껴드립니다.
          </motion.p>

          <motion.div variants={fadeUp} className="flex gap-3 mb-10">
            <motion.button
              whileHover={{ scale: 1.025, boxShadow: "0 0 36px rgba(91,140,110,0.4)" }}
              whileTap={{ scale: 0.975 }}
              transition={{ duration: 0.18 }}
              className="px-6 py-3 rounded-xl text-[13px] font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #5B8C6E 0%, #3A6B50 100%)",
                boxShadow: "0 4px 24px rgba(91,140,110,0.28)",
              }}
            >
              지금 바로 사용해보기 →
            </motion.button>
            <button className="px-6 py-3 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/75 transition-all duration-200">
              데모 보기
            </button>
          </motion.div>

          <motion.div variants={fadeUp} className="flex gap-6">
            {[["⚡", "10초 분석"], ["🔒", "완전 암호화"], ["⏱", "80% 시간 절약"]].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[12px] text-white/28">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* RIGHT — glassmorphism 데모 패널 */}
        <motion.div
          initial={{ opacity: 0, x: 30, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: parallaxY }}
        >
          <TypingDemo />
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <section
        className="relative z-10 border-y border-white/[0.05]"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(91,140,110,0.04) 50%, transparent 100%)" }}
      >
        <div className="max-w-[1180px] mx-auto px-10 py-12 grid grid-cols-3 divide-x divide-white/[0.05]">
          {STATS.map(({ num, label }, i) => (
            <motion.div
              key={label}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.6 }}
              className="text-center px-8"
            >
              <div
                className="text-[42px] font-bold mb-1"
                style={{
                  fontFamily: "Crimson Pro, Georgia, serif",
                  background: "linear-gradient(135deg, #A8E8C8 0%, #6FAE8D 60%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {num}
              </div>
              <div className="text-[12px] text-white/30 tracking-wide">{label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section className="relative z-10 px-10 py-20 max-w-[1180px] mx-auto">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-base">🔥</span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/30 font-medium">주요 기능</span>
          </div>
          <h2
            className="text-[28px] font-bold mb-10 leading-tight"
            style={{ fontFamily: "Crimson Pro, Georgia, serif", letterSpacing: "-0.01em" }}
          >
            가장 많이 쓰는 AI 기능
          </h2>
        </motion.div>

        <motion.div
          variants={stagger(0.07)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-4 gap-4"
        >
          {USE_CASES.map(({ icon, label, desc, tag }) => (
            <motion.div
              key={label}
              variants={scaleIn}
              whileHover={{ y: -5, borderColor: "rgba(91,140,110,0.38)" }}
              transition={{ duration: 0.22 }}
              className="group relative rounded-2xl border border-white/[0.07] p-5 cursor-pointer overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(24,34,28,0.85) 0%, rgba(16,24,20,0.85) 100%)",
                backdropFilter: "blur(8px)",
              }}
            >
              {/* hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                style={{ background: "radial-gradient(ellipse at 25% 25%, rgba(91,140,110,0.12) 0%, transparent 70%)" }}
              />

              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-4 border border-[#5B8C6E]/28 text-[#8FD1AD]"
                style={{ background: "rgba(91,140,110,0.1)" }}
              >
                {tag}
              </span>
              <div className="text-[22px] mb-2">{icon}</div>
              <div className="font-semibold text-[14px] mb-1 text-white/85">{label}</div>
              <div className="text-[12px] text-white/30 leading-relaxed">{desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section className="relative z-10 px-10 py-20 max-w-[1180px] mx-auto">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mb-10">
          <h2
            className="text-[28px] font-bold leading-tight"
            style={{ fontFamily: "Crimson Pro, Georgia, serif", letterSpacing: "-0.01em" }}
          >
            AI 도입 전후 비교
          </h2>
        </motion.div>

        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-5"
        >
          {/* BEFORE */}
          <motion.div
            variants={scaleIn}
            className="rounded-2xl border border-white/[0.06] p-6 overflow-hidden"
            style={{ background: "linear-gradient(145deg, rgba(18,18,18,0.75) 0%, rgba(12,12,12,0.75) 100%)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-red-500/50" />
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/25 font-medium">도입 전</span>
            </div>
            <div className="space-y-3">
              {BEFORE_ITEMS.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[13px] text-white/20">
                  <span className="mt-0.5 text-red-500/35 flex-shrink-0">✗</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* AFTER */}
          <motion.div
            variants={scaleIn}
            className="rounded-2xl border border-[#5B8C6E]/28 p-6 overflow-hidden relative"
            style={{
              background: "linear-gradient(145deg, rgba(26,40,30,0.88) 0%, rgba(18,28,22,0.88) 100%)",
              boxShadow: "0 0 40px rgba(91,140,110,0.07)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(111,174,141,0.38), transparent)" }}
            />
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-[#6FAE8D] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#6FAE8D] font-medium">ClauseAI 사용 후</span>
            </div>
            <div className="space-y-3">
              {AFTER_ITEMS.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[13px] text-white/72">
                  <span className="mt-0.5 text-[#6FAE8D] flex-shrink-0">✓</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative z-10 px-10 py-20 max-w-[1180px] mx-auto">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mb-10">
          <h2
            className="text-[28px] font-bold leading-tight"
            style={{ fontFamily: "Crimson Pro, Georgia, serif", letterSpacing: "-0.01em" }}
          >
            실사용자 후기
          </h2>
        </motion.div>

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-5"
        >
          {TESTIMONIALS.map(({ text, author, role, initial }, i) => (
            <motion.div
              key={i}
              variants={scaleIn}
              className="rounded-2xl border border-white/[0.06] p-5 relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(22,30,24,0.82) 0%, rgba(14,20,16,0.82) 100%)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(ellipse, rgba(91,140,110,${0.04 + i * 0.01}) 0%, transparent 70%)`, transform: "translate(40%, -40%)" }}
              />
              <div
                className="text-[#6FAE8D] text-sm mb-3"
                style={{ letterSpacing: "0.05em" }}
              >
                ★★★★★
              </div>
              <p className="text-[13px] text-white/55 leading-relaxed mb-5">&quot;{text}&quot;</p>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${145 + i * 18}, 38%, 32%), hsl(${145 + i * 18}, 32%, 22%))`,
                  }}
                >
                  {initial}
                </div>
                <div>
                  <div className="text-[12px] text-white/65 font-medium">{author}</div>
                  <div className="text-[10px] text-white/25">{role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 px-10 py-24 max-w-[1180px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl border border-[#5B8C6E]/18 p-16 text-center overflow-hidden"
          style={{
            background: "linear-gradient(145deg, rgba(26,40,32,0.75) 0%, rgba(14,22,16,0.9) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* top gradient line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(111,174,141,0.28), transparent)" }}
          />
          {/* ambient center glow */}
          <div
            className="absolute top-[-50%] left-[50%] translate-x-[-50%] w-[700px] h-[500px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(80,155,110,0.1) 0%, transparent 65%)" }}
          />

          <h2
            className="relative text-[38px] font-bold mb-4 leading-tight"
            style={{
              fontFamily: "Crimson Pro, Georgia, serif",
              letterSpacing: "-0.015em",
            }}
          >
            지금 바로 ClauseAI를<br />경험해보세요
          </h2>
          <p className="relative text-[14px] text-white/35 mb-10 leading-relaxed">
            신용카드 없이 무료로 시작 · 30일 내 환불 보장
          </p>

          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 0 56px rgba(91,140,110,0.48)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="relative px-10 py-4 rounded-xl text-[14px] font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #5B8C6E 0%, #3A6B50 100%)",
              boxShadow: "0 4px 32px rgba(91,140,110,0.32)",
            }}
          >
            무료로 시작하기 →
          </motion.button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.05] px-10 py-8">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #5B8C6E 0%, #3A6B50 100%)" }}
            >
              C
            </div>
            <span className="text-[12px] text-white/25">clauseai.kr</span>
          </div>
          <div className="flex gap-6 text-[12px] text-white/20">
            {["이용약관", "개인정보처리방침", "문의"].map((item) => (
              <span key={item} className="cursor-pointer hover:text-white/45 transition-colors">{item}</span>
            ))}
          </div>
          <div className="text-[11px] text-white/15">© 2026 ClauseAI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
