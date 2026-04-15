# HLB 보컬스튜디오 디자인 시스템 리디자인 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VocalMind를 HLB 보컬스튜디오로 리브랜딩하고, 디자인 시스템(토큰 + 공용 컴포넌트 5개) 구축 후 핵심 3페이지(랜딩/스케일연습/여정)에 적용한다.

**Architecture:** globals.css 토큰 교체 → 공용 React 컴포넌트 5개(Button/Card/NavBar/ScoreDisplay/MetricBar) 생성 → 인터랙션 훅(useRipple/useScrollReveal/useCountUp) → 랜딩 리디자인 → 스케일연습 적용 → 여정 적용 → 브랜드명 일괄 교체.

**Tech Stack:** Next.js 14, React 18, TypeScript, CSS Modules, Unsplash 실사 이미지

**스펙:** `docs/superpowers/specs/2026-04-06-design-system-redesign.md`

---

## 파일 구조

### 생성할 파일
```
components/ds/Button.tsx              — 4종 버튼 (Primary/Accent/Secondary/Ghost)
components/ds/Button.module.css       — 버튼 스타일 + 리플
components/ds/Card.tsx                — 3종 카드 (Default/Active/Locked)
components/ds/Card.module.css         — 카드 스타일 + 글로우
components/ds/NavBar.tsx              — 상단 네비게이션 (블러, 56px)
components/ds/NavBar.module.css       — 네비 스타일
components/ds/ScoreDisplay.tsx        — 원형 게이지 + 카운트업
components/ds/ScoreDisplay.module.css — 스코어 스타일
components/ds/MetricBar.tsx           — 라벨 + 바 + 숫자
components/ds/MetricBar.module.css    — 메트릭 스타일
lib/hooks/useRipple.ts                — 클릭 리플 효과 훅
lib/hooks/useScrollReveal.ts          — 스크롤 리빌 효과 훅
lib/hooks/useCountUp.ts               — 숫자 카운트업 훅
```

### 수정할 파일
```
app/globals.css                       — 토큰 전체 교체
app/layout.tsx                        — 메타데이터 브랜드명 변경
app/(marketing)/layout.tsx            — NavBar 교체
app/(marketing)/page.tsx              — 랜딩 페이지 import 변경
components/marketing/Hero.tsx         — 실사 배경 + 새 컴포넌트 적용
components/marketing/Hero.module.css  — 히어로 스타일 전면 교체
components/marketing/Features.tsx     — 글로우 카드 + SVG 아이콘
components/marketing/Features.module.css
components/marketing/CtaSection.tsx   — 실사 배경 CTA
components/marketing/CtaSection.module.css
components/shared/Nav.tsx             — NavBar 컴포넌트로 교체 (래퍼)
app/scale-practice/page.tsx           — Card/Button 컴포넌트 적용
app/scale-practice/[stageId]/ScalePracticeClient.tsx — NavBar, Button 적용
components/scale-practice/AutoLessonFlow.tsx — ScoreDisplay, MetricBar, Button 적용
app/journey/JourneyClient.tsx         — Card/Button 적용
app/journey/[stageId]/PracticeClient.tsx — ScoreDisplay 적용
```

---

## Task 1: globals.css 토큰 교체

**Files:**
- Modify: `app/globals.css:1-53`

- [ ] **Step 1: 토큰 교체**

기존 `:root` 블록을 새 디자인 시스템 토큰으로 교체한다. 레거시 앨리어스는 유지하여 기존 컴포넌트가 깨지지 않도록 한다.

```css
:root {
  /* ── Backgrounds (Zinc Elevation) ── */
  --bg-base:     #09090B;
  --bg-raised:   #111113;
  --bg-elevated: #1A1A1E;
  --bg-hover:    #222226;

  /* ── Text ── */
  --text-primary:   #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted:     #63636E;

  /* ── Accent ── */
  --accent:       #3B82F6;
  --accent-hover: #2563EB;
  --accent-muted: rgba(59,130,246,0.12);
  --accent-glow:  rgba(59,130,246,0.20);

  /* ── Semantic ── */
  --success:       #22C55E;
  --success-muted: rgba(34,197,94,0.12);
  --warning:       #EAB308;
  --warning-muted: rgba(234,179,8,0.12);
  --error:         #EF4444;
  --error-muted:   rgba(239,68,68,0.12);

  /* ── Borders ── */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.16);

  /* ── Radii ── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  /* ── Typography ── */
  --font-sans: 'Inter', 'Noto Sans KR', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --fs-display: clamp(2.75rem, 5vw, 4rem);
  --fs-h1:      clamp(2rem, 3.5vw, 2.75rem);
  --fs-h2:      clamp(1.375rem, 2vw, 1.75rem);
  --fs-h3:      1.125rem;
  --fs-body:    1rem;
  --fs-sm:      0.875rem;
  --fs-xs:      0.75rem;

  /* ── Easing ── */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* ── Legacy aliases (기존 컴포넌트 호환) ── */
  --bg:        var(--bg-base);
  --bg2:       var(--bg-raised);
  --bg3:       var(--bg-elevated);
  --surface:   rgba(255,255,255,0.05);
  --surface2:  rgba(255,255,255,0.08);
  --surface3:  rgba(255,255,255,0.12);
  --text:      var(--text-primary);
  --text2:     var(--text-secondary);
  --muted:     var(--text-muted);
  --border:    var(--border-subtle);
  --border2:   var(--border-strong);
  --accent-lt: #60A5FA;
  --accent2:   #8B5CF6;
  --accent2-lt:#A78BFA;
  --cta-bg:    var(--text-primary);
  --cta-text:  var(--bg-base);
  --cta-hover: #E4E4E7;
  --success-lt:#4ADE80;
  --error-lt:  #F87171;
  --r:         var(--radius-lg);
  --r-sm:      var(--radius-md);
  --r-xs:      var(--radius-sm);
  --gold:      var(--accent);
  --gold-lt:   var(--accent-lt);
  --violet:    var(--accent);
  --violet-lt: var(--accent-lt);
  --rose:      var(--error);
  --teal:      var(--success);
  --teal-lt:   var(--success-lt);
  --glow-blue: var(--accent-glow);
  --glow-purple: rgba(139,92,246,0.12);
  --glass-bg:  rgba(24,24,27,0.55);
  --fs-hero-display: var(--fs-display);
  --hero-title-lh: 1.05;
  --hero-title-ls: -0.03em;
}
```

`body` 스타일도 업데이트:
```css
body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.7;
  overflow-x: hidden;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npx next build 2>&1 | grep -E "error|Error|✓"`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: 커밋**

```bash
git add app/globals.css
git commit -m "refactor: 디자인 시스템 토큰 교체 (레거시 앨리어스 유지)"
```

---

## Task 2: 인터랙션 훅 3개

**Files:**
- Create: `lib/hooks/useRipple.ts`
- Create: `lib/hooks/useScrollReveal.ts`
- Create: `lib/hooks/useCountUp.ts`

- [ ] **Step 1: useRipple 작성**

```typescript
'use client';
import { useCallback, type MouseEvent } from 'react';

export function useRipple() {
  const createRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    Object.assign(ripple.style, {
      position: 'absolute',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.15)',
      width: `${size}px`,
      height: `${size}px`,
      left: `${e.clientX - rect.left - size / 2}px`,
      top: `${e.clientY - rect.top - size / 2}px`,
      transform: 'scale(0)',
      animation: 'ds-ripple 0.6s ease-out forwards',
      pointerEvents: 'none',
    });
    el.style.position = el.style.position || 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }, []);
  return createRipple;
}
```

- [ ] **Step 2: useScrollReveal 작성**

```typescript
'use client';
import { useEffect, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('ds-visible'); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}
```

- [ ] **Step 3: useCountUp 작성**

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const triggered = useRef(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true;
        let start: number | null = null;
        const step = (ts: number) => {
          if (!start) start = ts;
          const progress = Math.min((ts - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, value };
}
```

- [ ] **Step 4: globals.css에 리플 키프레임 + 리빌 클래스 추가**

`globals.css` 하단에 추가:
```css
/* ── DS: Ripple ── */
@keyframes ds-ripple {
  to { transform: scale(4); opacity: 0; }
}

/* ── DS: Scroll Reveal ── */
.ds-reveal {
  opacity: 0; transform: translateY(24px);
  transition: opacity 0.7s var(--ease-out-expo), transform 0.7s var(--ease-out-expo);
}
.ds-visible { opacity: 1; transform: translateY(0); }
```

- [ ] **Step 5: 빌드 확인**

Run: `npx next build 2>&1 | grep -E "error|Error|✓"`
Expected: `✓ Compiled successfully`

- [ ] **Step 6: 커밋**

```bash
git add lib/hooks/useRipple.ts lib/hooks/useScrollReveal.ts lib/hooks/useCountUp.ts app/globals.css
git commit -m "feat: 인터랙션 훅 3개 (useRipple, useScrollReveal, useCountUp)"
```

---

## Task 3: Button 컴포넌트

**Files:**
- Create: `components/ds/Button.tsx`
- Create: `components/ds/Button.module.css`

- [ ] **Step 1: Button.module.css 작성**

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--font-sans); font-size: 14px; font-weight: 600;
  padding: 13px 28px; border-radius: var(--radius-md);
  border: none; cursor: pointer; text-decoration: none;
  transition: all 0.2s ease; position: relative; overflow: hidden;
  line-height: 1;
}
.btn:active { transform: scale(0.97); }

.primary {
  background: var(--text-primary); color: var(--bg-base);
  box-shadow: 0 4px 16px rgba(255,255,255,0.1);
}
.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,255,255,0.15); }

.accent {
  background: var(--accent); color: #fff;
  box-shadow: 0 4px 16px rgba(59,130,246,0.25);
}
.accent:hover { background: var(--accent-hover); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59,130,246,0.3); }

.secondary {
  background: rgba(255,255,255,0.06); color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.secondary:hover { background: rgba(255,255,255,0.10); border-color: var(--border-strong); }

.ghost {
  background: transparent; color: var(--text-secondary); padding: 13px 16px;
}
.ghost:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }

.fullWidth { width: 100%; }
.sm { font-size: 13px; padding: 10px 20px; }
.lg { font-size: 15px; padding: 15px 36px; }
```

- [ ] **Step 2: Button.tsx 작성**

```tsx
'use client';

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { useRipple } from '@/lib/hooks/useRipple';
import s from './Button.module.css';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', fullWidth, className, onClick, children, ...rest }, ref) => {
    const ripple = useRipple();
    const cls = [
      s.btn,
      s[variant],
      size !== 'md' && s[size],
      fullWidth && s.fullWidth,
      className,
    ].filter(Boolean).join(' ');

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      ripple(e);
      onClick?.(e);
    };

    return (
      <button ref={ref} className={cls} onClick={handleClick} {...rest}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
export default Button;
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
git add components/ds/Button.tsx components/ds/Button.module.css
git commit -m "feat: ds/Button 컴포넌트 (4종 + 리플 효과)"
```

---

## Task 4: Card 컴포넌트

**Files:**
- Create: `components/ds/Card.tsx`
- Create: `components/ds/Card.module.css`

- [ ] **Step 1: Card.module.css 작성**

```css
.card {
  background: var(--bg-raised); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg); padding: 28px;
  transition: all 0.25s ease; position: relative; overflow: hidden;
}
.card:hover { border-color: var(--border-default); }

.interactive { cursor: pointer; }
.interactive:hover { transform: translateY(-4px); }
.interactive:active { transform: translateY(-2px) scale(0.99); }

.active { border-color: rgba(59,130,246,0.30); padding-left: 32px; }
.active::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: var(--accent);
}
.active::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at top left, rgba(59,130,246,0.06), transparent 70%);
  pointer-events: none;
}

.locked { opacity: 0.35; cursor: default; }
.locked:hover { border-color: var(--border-subtle); transform: none; }

.glow { position: relative; }
.glow::before {
  content: ''; position: absolute; inset: -1px; border-radius: inherit;
  background: radial-gradient(300px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(59,130,246,0.12), transparent 60%);
  opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 0;
}
.glow:hover::before { opacity: 1; }
```

- [ ] **Step 2: Card.tsx 작성**

```tsx
'use client';

import { forwardRef, type HTMLAttributes, type MouseEvent, useCallback } from 'react';
import s from './Card.module.css';

type Variant = 'default' | 'active' | 'locked';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  interactive?: boolean;
  glow?: boolean;
}

const Card = forwardRef<HTMLDivElement, Props>(
  ({ variant = 'default', interactive, glow, className, onMouseMove, children, ...rest }, ref) => {
    const cls = [
      s.card,
      variant !== 'default' && s[variant],
      interactive && s.interactive,
      glow && s.glow,
      className,
    ].filter(Boolean).join(' ');

    const handleMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
      if (glow) {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
      }
      onMouseMove?.(e);
    }, [glow, onMouseMove]);

    return (
      <div ref={ref} className={cls} onMouseMove={handleMove} {...rest}>
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';
export default Card;
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
git add components/ds/Card.tsx components/ds/Card.module.css
git commit -m "feat: ds/Card 컴포넌트 (3종 + 글로우 트래킹)"
```

---

## Task 5: NavBar 컴포넌트

**Files:**
- Create: `components/ds/NavBar.tsx`
- Create: `components/ds/NavBar.module.css`

- [ ] **Step 1: NavBar.module.css 작성**

```css
.nav {
  position: sticky; top: 0; z-index: 100;
  height: 56px; background: rgba(9,9,11,0.85);
  backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--border-subtle);
  display: flex; align-items: center; padding: 0 28px;
}
.logo {
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  color: var(--text-primary); margin-right: 40px;
  display: flex; align-items: center; gap: 8px;
  text-decoration: none;
}
.logoMark {
  width: 24px; height: 24px; border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), #8B5CF6);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.logoMark svg { width: 14px; height: 14px; color: #fff; }
.links { display: flex; gap: 28px; flex: 1; }
.link {
  font-size: 13px; font-weight: 500; color: var(--text-muted);
  text-decoration: none; padding: 17px 0; position: relative;
  transition: color 0.15s;
}
.link:hover { color: var(--text-secondary); }
.active { color: var(--text-primary); }
.active::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0;
  height: 2px; background: var(--accent); border-radius: 1px;
}
.right { display: flex; align-items: center; gap: 12px; }

@media (max-width: 768px) {
  .links { display: none; }
  .nav { padding: 0 16px; }
}
```

- [ ] **Step 2: NavBar.tsx 작성**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from './NavBar.module.css';

const NAV_ITEMS = [
  { href: '/journey', label: '소리의 길' },
  { href: '/scale-practice', label: '스케일' },
  { href: '/practice', label: '연습실' },
  { href: '/coach', label: 'AI 코치' },
];

interface Props {
  children?: React.ReactNode; // 우측 슬롯 (로그인 버튼 등)
}

export default function NavBar({ children }: Props) {
  const pathname = usePathname();

  return (
    <nav className={s.nav}>
      <Link href="/" className={s.logo}>
        <span className={s.logoMark}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
        </span>
        HLB 보컬스튜디오
      </Link>
      <div className={s.links}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${s.link} ${pathname.startsWith(item.href) ? s.active : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className={s.right}>
        {children}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
git add components/ds/NavBar.tsx components/ds/NavBar.module.css
git commit -m "feat: ds/NavBar 컴포넌트 (블러 배경 + HLB 보컬스튜디오 로고)"
```

---

## Task 6: ScoreDisplay + MetricBar 컴포넌트

**Files:**
- Create: `components/ds/ScoreDisplay.tsx`
- Create: `components/ds/ScoreDisplay.module.css`
- Create: `components/ds/MetricBar.tsx`
- Create: `components/ds/MetricBar.module.css`

- [ ] **Step 1: ScoreDisplay 작성**

ScoreDisplay.module.css:
```css
.wrap { text-align: center; }
.ring { width: 180px; height: 180px; position: relative; margin: 0 auto 20px; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 5; stroke-linecap: round; }
.bg { stroke: rgba(255,255,255,0.05); }
.fill { transition: stroke-dashoffset 1.2s var(--ease-out-expo); }
.value {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.num {
  font-family: var(--font-mono); font-size: 56px; font-weight: 700;
  letter-spacing: -0.03em; line-height: 1;
}
.label {
  font-size: 11px; color: var(--text-muted); font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase; margin-top: 6px;
}
.verdict { font-size: 16px; font-weight: 600; }
```

ScoreDisplay.tsx:
```tsx
'use client';

import { useCountUp } from '@/lib/hooks/useCountUp';
import s from './ScoreDisplay.module.css';

function getColor(score: number): string {
  if (score >= 90) return 'var(--success)';
  if (score >= 70) return 'var(--accent)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--error)';
}

interface Props {
  score: number;
  passed?: boolean;
  label?: string;
}

export default function ScoreDisplay({ score, passed, label = 'Score' }: Props) {
  const { ref, value } = useCountUp(score);
  const color = getColor(score);
  const circumference = 2 * Math.PI * 80; // r=80
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={s.wrap}>
      <div className={s.ring}>
        <svg viewBox="0 0 180 180">
          <circle className={s.bg} cx="90" cy="90" r="80" />
          <circle
            className={s.fill} cx="90" cy="90" r="80"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={s.value}>
          <span ref={ref as React.Ref<HTMLSpanElement>} className={s.num} style={{ color }}>
            {value}
          </span>
          <span className={s.label}>{label}</span>
        </div>
      </div>
      {passed !== undefined && (
        <div className={s.verdict} style={{ color }}>
          {passed ? '통과' : '재도전'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: MetricBar 작성**

MetricBar.module.css:
```css
.metric { margin-bottom: 16px; }
.header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.label { font-size: 12px; color: var(--text-muted); }
.value {
  font-family: var(--font-mono); font-size: 12px;
  font-weight: 600; color: var(--text-secondary);
}
.bar {
  height: 4px; border-radius: 2px;
  background: rgba(255,255,255,0.04); overflow: hidden;
}
.fill {
  height: 100%; border-radius: 2px;
  transition: width 1s var(--ease-out-expo);
}
```

MetricBar.tsx:
```tsx
import s from './MetricBar.module.css';

interface Props {
  label: string;
  value: number;
  color?: string;
}

export default function MetricBar({ label, value, color = 'var(--accent)' }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={s.metric}>
      <div className={s.header}>
        <span className={s.label}>{label}</span>
        <span className={s.value}>{Math.round(value)}</span>
      </div>
      <div className={s.bar}>
        <div className={s.fill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
git add components/ds/
git commit -m "feat: ds/ScoreDisplay + ds/MetricBar 컴포넌트"
```

---

## Task 7: 브랜드명 일괄 변경

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/shared/Nav.tsx`
- Search & replace across marketing components

- [ ] **Step 1: layout.tsx 메타데이터 변경**

`app/layout.tsx`에서:
```typescript
export const metadata: Metadata = {
  title: 'HLB 보컬스튜디오 — 당신의 목소리를 깨워드립니다',
  description: '7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 나만의 보컬 코치',
};
```

- [ ] **Step 2: Nav.tsx를 NavBar 래퍼로 변경**

`components/shared/Nav.tsx`를 읽고, NavBar를 import하는 래퍼로 교체:
```tsx
'use client';
export { default } from '@/components/ds/NavBar';
```

- [ ] **Step 3: 마케팅 컴포넌트에서 "보컬마인드" / "VocalMind" 검색하여 "HLB 보컬스튜디오"로 교체**

Run: `grep -r "보컬마인드\|VocalMind" components/marketing/ app/(marketing)/ --include="*.tsx" -l`

각 파일에서 텍스트 교체.

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
git add app/layout.tsx components/shared/Nav.tsx components/marketing/ app/\(marketing\)/
git commit -m "refactor: 브랜드명 HLB 보컬스튜디오로 일괄 변경"
```

---

## Task 8: 랜딩 페이지 리디자인

**Files:**
- Modify: `components/marketing/Hero.tsx`
- Modify: `components/marketing/Hero.module.css`
- Modify: `components/marketing/Features.tsx`
- Modify: `components/marketing/Features.module.css`
- Modify: `components/marketing/CtaSection.tsx`
- Modify: `components/marketing/CtaSection.module.css`

- [ ] **Step 1: Hero 리디자인**

Hero.tsx를 읽고 전면 교체:
- Unsplash 실사 배경 (레코딩 스튜디오)
- filter: brightness(0.25) saturate(0.7)
- 그라데이션 오버레이 (상→하 페이드)
- 배지 ("AI 보컬 코칭" + 펄싱 도트)
- `<Button variant="primary">무료로 시작하기</Button>`
- `<Button variant="secondary">둘러보기</Button>`
- useScrollReveal 적용

Hero.module.css 전면 교체 (design-preview.html의 .hero 스타일 참조).

- [ ] **Step 2: Features 리디자인**

Features.tsx를 읽고 교체:
- 이모지 아이콘 → SVG 아이콘 (마이크, 피아노, 음표)
- `<Card glow interactive>` 사용
- 피처 아이콘: accent-muted 배경, 44px, border-radius 10px
- section-label + section-title 패턴

- [ ] **Step 3: CtaSection 리디자인**

CtaSection.tsx 교체:
- Unsplash 실사 배경 (가수 퍼포먼스)
- brightness(0.2) saturate(0.6) + radial-gradient 오버레이
- `<Button variant="primary" size="lg">무료 체험 시작</Button>`

- [ ] **Step 4: 빌드 확인 + 브라우저 스크린샷 확인**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
```

Playwright로 스크린샷:
```bash
npx playwright screenshot --viewport-size="1280,800" http://localhost:3006/ landing.png
```

- [ ] **Step 5: 커밋**

```bash
git add components/marketing/ app/globals.css
git commit -m "feat: 랜딩 페이지 리디자인 (실사 배경 + ds 컴포넌트 적용)"
```

---

## Task 9: 스케일 연습 페이지 ds 적용

**Files:**
- Modify: `app/scale-practice/page.tsx`
- Modify: `app/scale-practice/[stageId]/ScalePracticeClient.tsx`
- Modify: `components/scale-practice/AutoLessonFlow.tsx`

- [ ] **Step 1: 메인 페이지에 Card/Button import**

`app/scale-practice/page.tsx`를 읽고:
- styled-jsx를 CSS Module 또는 ds 컴포넌트로 교체
- 스테이지 카드를 `<Card interactive>` / `<Card variant="locked">` 사용
- 번호는 `font-family: var(--font-mono)`
- 잠금 아이콘은 SVG 유지
- 이모지 제거 (블록 아이콘 등)

- [ ] **Step 2: ScalePracticeClient에 NavBar 연동 확인**

`ScalePracticeClient.tsx`의 헤더를 ds 스타일로 통일.
모드 전환 버튼을 `<Button variant="ghost" size="sm">` 사용.

- [ ] **Step 3: AutoLessonFlow에 ScoreDisplay/MetricBar/Button 적용**

`AutoLessonFlow.tsx`를 읽고:
- 결과 화면의 점수를 `<ScoreDisplay score={...} passed={...} />` 교체
- 메트릭 바를 `<MetricBar label="이완" value={82} color="var(--success)" />` 교체
- 버튼을 `<Button variant="secondary">다시</Button>` + `<Button variant="accent">다음 단계</Button>` 교체

- [ ] **Step 4: 빌드 확인 + 스크린샷**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
npx playwright screenshot --viewport-size="390,844" http://localhost:3006/scale-practice sp-final.png
npx playwright screenshot --viewport-size="390,844" http://localhost:3006/scale-practice/1 sp-lesson-final.png
```

- [ ] **Step 5: 커밋**

```bash
git add app/scale-practice/ components/scale-practice/
git commit -m "feat: 스케일 연습 페이지 ds 컴포넌트 적용"
```

---

## Task 10: 여정 페이지 ds 적용

**Files:**
- Modify: `app/journey/JourneyClient.tsx`
- Modify: `app/journey/[stageId]/PracticeClient.tsx`

- [ ] **Step 1: JourneyClient에 Card/Button 적용**

`JourneyClient.tsx`를 읽고:
- 현재 단계 카드: `<Card variant="active">` + `<Button variant="accent">연습 시작</Button>`
- 완료 단계: `<Card>` + 체크마크 SVG
- 잠금 단계: `<Card variant="locked">`
- 이모지 제거

- [ ] **Step 2: PracticeClient에 ScoreDisplay 적용**

기존 점수 표시를 `<ScoreDisplay>` + `<MetricBar>` 교체.

- [ ] **Step 3: 빌드 확인 + 스크린샷**

```bash
npx next build 2>&1 | grep -E "error|Error|✓"
npx playwright screenshot --viewport-size="390,844" http://localhost:3006/journey journey-final.png
```

- [ ] **Step 4: 커밋**

```bash
git add app/journey/
git commit -m "feat: 여정 페이지 ds 컴포넌트 적용"
```

---

## Task 11: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```
Expected: 76 passed

- [ ] **Step 2: 빌드 확인**

```bash
cd .. && npx next build
```
Expected: Compiled successfully

- [ ] **Step 3: 브랜드명 잔여 검색**

```bash
grep -r "보컬마인드\|VocalMind" app/ components/ lib/ stores/ types/ --include="*.tsx" --include="*.ts" -l
```
Expected: 0 results (또는 주석/변수명만)

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: HLB 보컬스튜디오 디자인 시스템 리디자인 완료"
```

---

## 요약

| Task | 내용 | 예상 파일 수 |
|------|------|------------|
| 1 | globals.css 토큰 교체 | 1 |
| 2 | 인터랙션 훅 3개 | 4 |
| 3 | Button 컴포넌트 | 2 |
| 4 | Card 컴포넌트 | 2 |
| 5 | NavBar 컴포넌트 | 2 |
| 6 | ScoreDisplay + MetricBar | 4 |
| 7 | 브랜드명 일괄 변경 | 5+ |
| 8 | 랜딩 페이지 리디자인 | 6 |
| 9 | 스케일 연습 ds 적용 | 3 |
| 10 | 여정 페이지 ds 적용 | 2 |
| 11 | 최종 검증 | 0 |
