# HLB 보컬스튜디오 UI 전면 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSS Modules 102개 + 커스텀 DS를 shadcn/ui + Tailwind v4 + 딥 포레스트 그린 디자인 시스템으로 전면 교체

**Architecture:** globals.css의 디자인 토큰을 딥 포레스트 그린 컬러 시스템으로 교체하고, `next-themes`로 다크/라이트 전환을 추가한다. 기존 `components/ds/` 5개 컴포넌트를 shadcn/ui 기반 GlowCard 등 신규 컴포넌트로 대체하고, 모든 페이지의 `.module.css` import를 Tailwind 클래스로 전환한다. 각 페이지 마이그레이션 후 즉시 `npm run build`로 검증한다.

**Tech Stack:** shadcn/ui (Radix) + Tailwind v4 + framer-motion 12 + next-themes + lucide-react + Canvas API

**Design Spec:** `docs/superpowers/specs/2026-04-11-ui-redesign-design.md`

---

## Phase 1: Foundation (테마 + 토큰 + 핵심 컴포넌트)

### Task 1: next-themes 설치 + ThemeProvider 설정

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/theme-provider.tsx`
- Modify: `package.json` (npm install)

- [ ] **Step 1: next-themes 설치**

```bash
cd vocalmind_2/vocalmind && npm install next-themes
```

- [ ] **Step 2: ThemeProvider 컴포넌트 생성**

```tsx
// components/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: layout.tsx에 ThemeProvider 래핑 + Noto Serif KR 폰트 추가**

`app/layout.tsx`를 수정하여:
- `<body>` 안에 `<ThemeProvider>{children}</ThemeProvider>` 래핑
- `<html lang="ko">` 에 `suppressHydrationWarning` 추가
- Google Fonts URL에 `Noto+Serif+KR:wght@300;400` 추가

```tsx
import { ThemeProvider } from '@/components/theme-provider';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@300;400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        {/* nonce carrier for CSP */}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 빌드 검증**

```bash
npm run build
```
Expected: 에러 없이 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add components/theme-provider.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat: add next-themes ThemeProvider + Noto Serif KR font"
```

---

### Task 2: globals.css 디자인 토큰 전면 교체

**Files:**
- Modify: `app/globals.css`

이 태스크는 globals.css의 `:root` 토큰과 shadcn 변수를 딥 포레스트 그린 컬러 시스템으로 교체한다.
기존 legacy alias는 유지하되 새 값을 가리키도록 업데이트한다.

- [ ] **Step 1: `:root` 커스텀 토큰을 딥 포레스트 그린으로 교체**

`:root` 블록의 기존 색상을 아래로 교체:

```css
:root {
  /* ── Backgrounds (Deep Forest) ── */
  --bg-base:     #080C0A;
  --bg-raised:   #0E1410;
  --bg-elevated: #151D18;
  --bg-hover:    #1C2620;

  /* ── Text ── */
  --text-primary:   #E2E6E3;
  --text-secondary: #7A8A80;
  --text-muted:     #4A5A50;
  --text-dim:       #3A4A40;

  /* ── Accent (Deep Forest Green) ── */
  --accent:         #5B8C6E;
  --accent-hover:   #4A7A5D;
  --accent-light:   #6EAA80;
  --accent-bright:  #8CC6A0;
  --accent-muted:   rgba(91,140,110,0.12);
  --accent-glow:    rgba(80,180,120,0.25);

  /* ── Semantic ── */
  --success:       #10B981;
  --success-muted: rgba(16,185,129,0.12);
  --warning:       #F59E0B;
  --warning-muted: rgba(245,158,11,0.12);
  --error:         #F43F5E;
  --error-muted:   rgba(244,63,94,0.12);
  --streak-gold:   #FBBF24;

  /* ── Borders ── */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.16);

  /* ── Radii ── */
  --radius: 0.625rem;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  /* ── Typography ── */
  --font-display: 'Crimson Pro', 'Noto Serif KR', Georgia, serif;
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
}
```

- [ ] **Step 2: legacy alias 업데이트**

기존 legacy alias를 새 토큰에 맞게 교체:

```css
  /* ── Legacy aliases ── */
  --bg:        var(--bg-base);
  --bg2:       var(--bg-raised);
  --bg3:       var(--bg-elevated);
  --surface:   rgba(255,255,255,0.03);
  --surface2:  rgba(255,255,255,0.06);
  --surface3:  rgba(255,255,255,0.10);
  --text:      var(--text-primary);
  --text2:     var(--text-secondary);
  --muted:     var(--text-muted);
  --border:    var(--border-default);
  --border2:   var(--border-strong);
  --accent-lt: var(--accent-light);
  --accent2:   var(--accent-bright);
  --accent2-lt:var(--accent-bright);
  --cta-bg:    var(--accent);
  --cta-text:  #FFFFFF;
  --cta-hover: var(--accent-hover);
  --success-lt:var(--success);
  --error-lt:  var(--error);
  --r:         var(--radius-lg);
  --r-sm:      var(--radius-md);
  --r-xs:      var(--radius-sm);
  --gold:      var(--streak-gold);
  --gold-lt:   var(--streak-gold);
  --violet:    var(--accent);
  --violet-lt: var(--accent-light);
  --rose:      var(--error);
  --teal:      var(--success);
  --teal-lt:   var(--success);
  --glow-blue: var(--accent-glow);
  --glow-purple: var(--accent-muted);
  --glass-bg:  rgba(14,20,16,0.55);
```

- [ ] **Step 3: shadcn 테마 변수를 딥 포레스트 그린으로 교체**

`:root` (라이트) + `.dark` (다크) shadcn 변수 교체:

```css
  /* ── shadcn Light Theme ── */
  --background:     oklch(0.97 0.005 155);
  --foreground:     oklch(0.18 0.02 155);
  --card:           oklch(0.99 0.002 155);
  --card-foreground: oklch(0.18 0.02 155);
  --popover:        oklch(0.99 0.002 155);
  --popover-foreground: oklch(0.18 0.02 155);
  --primary:        oklch(0.55 0.12 155);
  --primary-foreground: oklch(0.99 0 0);
  --secondary:      oklch(0.94 0.01 155);
  --secondary-foreground: oklch(0.25 0.02 155);
  --muted-foreground: oklch(0.50 0.02 155);
  --accent-foreground: oklch(0.25 0.02 155);
  --destructive:    oklch(0.577 0.245 27.325);
  --input:          oklch(0.90 0.01 155);
  --ring:           oklch(0.55 0.12 155);
```

`.dark` 블록:

```css
.dark {
  --background:     oklch(0.12 0.015 155);
  --foreground:     oklch(0.93 0.005 155);
  --card:           oklch(0.16 0.015 155);
  --card-foreground: oklch(0.93 0.005 155);
  --popover:        oklch(0.16 0.015 155);
  --popover-foreground: oklch(0.93 0.005 155);
  --primary:        oklch(0.60 0.12 155);
  --primary-foreground: oklch(0.12 0.015 155);
  --secondary:      oklch(0.20 0.015 155);
  --secondary-foreground: oklch(0.93 0.005 155);
  --muted:          oklch(0.20 0.015 155);
  --muted-foreground: oklch(0.60 0.01 155);
  --accent:         oklch(0.20 0.015 155);
  --accent-foreground: oklch(0.93 0.005 155);
  --destructive:    oklch(0.704 0.191 22.216);
  --border:         oklch(1 0 0 / 8%);
  --input:          oklch(1 0 0 / 12%);
  --ring:           oklch(0.60 0.12 155);
}
```

- [ ] **Step 4: gradient-bg와 keyframes 색상 교체**

`.gradient-bg` 배경을 그린으로:

```css
.gradient-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 800px 600px at 15% 20%, rgba(91,140,110,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 600px 700px at 85% 80%, rgba(80,180,120,0.05) 0%, transparent 60%);
  animation: gradShift 18s ease-in-out infinite alternate;
}
```

`ctaGlow` keyframe:

```css
@keyframes ctaGlow {
  0%, 100% { box-shadow: 0 6px 30px rgba(91,140,110,0.15); }
  50%      { box-shadow: 0 6px 40px rgba(91,140,110,0.30), 0 0 60px rgba(80,180,120,0.15); }
}
```

- [ ] **Step 5: body 스타일 + btn 클래스 색상 교체**

`body` background already uses `var(--bg-base)` so token change auto-applies.

`.btn-primary`, `.btn-gold` 배경/hover 색상:
```css
.btn-primary, .btn-gold {
  background: var(--accent);
  color: #FFFFFF;
  box-shadow: 0 6px 30px var(--accent-glow);
}
.btn-primary:hover, .btn-gold:hover {
  background: var(--accent-hover);
  box-shadow: 0 12px 40px rgba(91,140,110,0.30);
}
```

`.section-title em` 그라데이션:
```css
.section-title em {
  background: linear-gradient(110deg, var(--accent-light), var(--accent-bright));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

- [ ] **Step 6: `@theme inline` 블록에 display 폰트 추가**

```css
@theme inline {
  --font-display:   var(--font-display);
  --font-heading:   var(--font-display);
  --font-sans:      var(--font-sans);
  /* ...기존 color 매핑 유지... */
}
```

- [ ] **Step 7: 빌드 검증**

```bash
npm run build
```
Expected: 에러 없이 빌드 성공. 색상이 빨강/골드에서 그린으로 변경됨.

- [ ] **Step 8: 커밋**

```bash
git add app/globals.css
git commit -m "feat: replace color system to deep forest green theme"
```

---

### Task 3: GlowCard 컴포넌트 생성

**Files:**
- Create: `components/ui/glow-card.tsx`

디자인 프리뷰에서 승인된 3D 깊이감 + 발광 카드 컴포넌트. 모든 페이지에서 재사용.

- [ ] **Step 1: GlowCard 컴포넌트 작성**

```tsx
// components/ui/glow-card.tsx
'use client';

import { forwardRef, useCallback, type HTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  glow?: boolean;
  hover3d?: boolean;
}

const GlowCard = forwardRef<HTMLDivElement, GlowCardProps>(
  ({ active, glow, hover3d = true, className, onMouseMove, onMouseLeave, children, style, ...rest }, ref) => {

    const handleMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
      if (!glow && !hover3d) { onMouseMove?.(e); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (glow) {
        e.currentTarget.style.setProperty('--glow-x', `${x}px`);
        e.currentTarget.style.setProperty('--glow-y', `${y}px`);
      }
      if (hover3d) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -3;
        const rotateY = ((x - centerX) / centerX) * 3;
        e.currentTarget.style.transform =
          `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
      onMouseMove?.(e);
    }, [glow, hover3d, onMouseMove]);

    const handleLeave = useCallback((e: MouseEvent<HTMLDivElement>) => {
      if (hover3d) {
        e.currentTarget.style.transform =
          'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      }
      onMouseLeave?.(e);
    }, [hover3d, onMouseLeave]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-xl border border-white/[0.06] overflow-hidden transition-all duration-300',
          'bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-sm',
          'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent',
          'shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]',
          'hover:border-white/[0.10] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]',
          active && [
            'border-t-2 border-t-[#5B8C6E]/60',
            'shadow-[0_4px_24px_rgba(80,180,120,0.15),0_0_40px_rgba(80,180,120,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
          ],
          glow && 'after:absolute after:w-32 after:h-32 after:rounded-full after:bg-[rgba(80,180,120,0.12)] after:blur-3xl after:pointer-events-none after:transition-opacity after:opacity-0 hover:after:opacity-100 after:left-[var(--glow-x)] after:top-[var(--glow-y)] after:-translate-x-1/2 after:-translate-y-1/2',
          className,
        )}
        style={{ willChange: hover3d ? 'transform' : undefined, ...style }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
GlowCard.displayName = 'GlowCard';

export { GlowCard };
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add components/ui/glow-card.tsx
git commit -m "feat: add GlowCard component with 3D depth + green glow"
```

---

### Task 4: SoundWaveBackground 컴포넌트 생성

**Files:**
- Create: `components/ui/sound-wave-bg.tsx`

디자인 프리뷰에서 승인된 Canvas 기반 음파 배경 애니메이션.

- [ ] **Step 1: SoundWaveBackground 작성**

```tsx
// components/ui/sound-wave-bg.tsx
'use client';

import { useEffect, useRef } from 'react';

export function SoundWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const waves = [
      { amplitude: 30, frequency: 0.008, speed: 0.015, alpha: 0.08, blur: 20 },
      { amplitude: 20, frequency: 0.012, speed: 0.020, alpha: 0.06, blur: 30 },
      { amplitude: 40, frequency: 0.005, speed: 0.010, alpha: 0.05, blur: 40 },
      { amplitude: 15, frequency: 0.015, speed: 0.025, alpha: 0.04, blur: 50 },
      { amplitude: 25, frequency: 0.010, speed: 0.018, alpha: 0.07, blur: 25 },
      { amplitude: 35, frequency: 0.007, speed: 0.012, alpha: 0.05, blur: 35 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerY = canvas.height * 0.5;

      for (const w of waves) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(100, 200, 140, ${w.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(80, 180, 120, 0.4)';
        ctx.shadowBlur = w.blur;

        for (let x = 0; x < canvas.width; x += 3) {
          const y = centerY +
            Math.sin(x * w.frequency + time * w.speed) * w.amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      time += 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none opacity-60"
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add components/ui/sound-wave-bg.tsx
git commit -m "feat: add Canvas sound wave background component"
```

---

### Task 5: ScoreRing 컴포넌트 생성 (ScoreDisplay 대체)

**Files:**
- Create: `components/ui/score-ring.tsx`

기존 `ds/ScoreDisplay` (CSS Module + useCountUp)를 SVG ring + framer-motion으로 대체.

- [ ] **Step 1: ScoreRing 작성**

```tsx
// components/ui/score-ring.tsx
'use client';

import { motion } from 'framer-motion';
import { useCountUp } from '@/lib/hooks/useCountUp';

interface ScoreRingProps {
  score: number;
  passed?: boolean;
  label?: string;
  size?: number;
}

export function ScoreRing({
  score, passed, label = '점수', size = 120,
}: ScoreRingProps) {
  const displayScore = useCountUp(score, 1200);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 90
    ? 'var(--success)'
    : score >= 70
      ? 'var(--accent-light)'
      : score >= 40
        ? 'var(--warning)'
        : 'var(--error)';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-[var(--text-primary)] font-mono">
            {displayScore}
          </span>
          {passed !== undefined && (
            <span className={`text-xs mt-0.5 ${
              passed ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
            }`}>
              {passed ? '통과' : '미통과'}
            </span>
          )}
        </div>
      </div>
      <span
        className="text-xs text-[var(--text-muted)] uppercase tracking-wider"
        style={{ textShadow: '0 0 12px rgba(80,180,120,0.3)' }}
      >
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add components/ui/score-ring.tsx
git commit -m "feat: add ScoreRing component with SVG + framer-motion"
```

---

### Task 6: MetricBar 대체 컴포넌트 생성

**Files:**
- Create: `components/ui/metric-bar.tsx`

기존 `ds/MetricBar` (CSS Module)를 Tailwind + framer-motion으로 대체.

- [ ] **Step 1: MetricBar 작성**

```tsx
// components/ui/metric-bar.tsx
'use client';

import { motion } from 'framer-motion';

interface MetricBarProps {
  label: string;
  value: number;
  color?: string;
}

export function MetricBar({
  label, value, color = 'var(--accent)',
}: MetricBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-primary)] font-mono font-medium">
          {Math.round(value)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 검증 + 커밋**

```bash
npm run build
git add components/ui/metric-bar.tsx
git commit -m "feat: add MetricBar component with framer-motion animation"
```

---

### Task 7: ThemeToggle 컴포넌트 생성

**Files:**
- Create: `components/ui/theme-toggle.tsx`

다크/라이트 전환 버튼. Nav에 삽입될 예정.

- [ ] **Step 1: ThemeToggle 작성**

```tsx
// components/ui/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      aria-label="테마 변경"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[var(--accent-light)]" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--accent)]" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: 빌드 검증 + 커밋**

```bash
npm run build
git add components/ui/theme-toggle.tsx
git commit -m "feat: add ThemeToggle dark/light switch"
```

---

## Phase 2: 공통 컴포넌트 마이그레이션 (ds/ + shared/)

### Task 8: Nav 컴포넌트 마이그레이션

**Files:**
- Modify: `components/shared/Nav.tsx`
- Delete: `components/shared/Nav.module.css`

현재 Nav는 `styles.nav`, `styles.scrolled` 등 CSS Module 클래스를 사용한다.
이를 Tailwind 클래스로 전환하고, ThemeToggle을 추가한다.

- [ ] **Step 1: Nav.tsx를 Tailwind 클래스로 전면 재작성**

CSS Module import 제거, 모든 `styles.xxx` -> Tailwind 클래스로 변환.
핵심 스타일 매핑:
- `nav`: `fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent`
- `nav.scrolled`: `bg-[var(--bg-base)]/80 backdrop-blur-md border-white/[0.06]`
- `navInner`: `max-w-[1200px] mx-auto px-7 h-16 flex items-center justify-between`
- `logo`: `flex items-center gap-2.5 text-[var(--text-primary)] no-underline`
- `logoMark`: `w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-bright)] flex items-center justify-center`
- `navLinks`: `hidden md:flex items-center gap-1`
- `navLinks a`: `px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors`
- `navCta`: `ml-2 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-[0_0_20px_var(--accent-glow)]`
- `hamburger`: `md:hidden flex flex-col gap-1 p-2`
- `mobileMenu`: `fixed inset-0 z-[100] bg-[var(--bg-base)]/95 backdrop-blur-lg flex flex-col items-center justify-center gap-6 text-lg transition-all duration-300`
- `mobileMenu:not(.open)`: `opacity-0 pointer-events-none`

ThemeToggle을 navLinks 마지막 (CTA 버튼 앞)에 추가.
기존 JSX 구조 유지하되 className만 교체.

- [ ] **Step 2: Nav.module.css 삭제**

```bash
rm components/shared/Nav.module.css
```

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add components/shared/Nav.tsx
git rm components/shared/Nav.module.css
git commit -m "refactor: migrate Nav to Tailwind + add ThemeToggle"
```

---

### Task 9: Footer 컴포넌트 마이그레이션

**Files:**
- Modify: `components/shared/Footer.tsx`
- Delete: `components/shared/Footer.module.css`

- [ ] **Step 1: Footer.tsx Tailwind 전환**

CSS Module import 제거. 기존 레이아웃(3~4컬럼 grid, 소셜 아이콘) 유지.
핵심 스타일:
- `footer`: `border-t border-white/[0.06] bg-[var(--bg-base)] py-16`
- `footerInner`: `max-w-[1200px] mx-auto px-7 grid grid-cols-1 md:grid-cols-4 gap-12`
- `brand`: `col-span-1 md:col-span-2`
- `links a`: `text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors`
- `socialIcon`: `w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center hover:bg-[var(--accent)]/20 transition-colors`

- [ ] **Step 2: Footer.module.css 삭제**

```bash
rm components/shared/Footer.module.css
```

- [ ] **Step 3: 빌드 검증 + 커밋**

```bash
npm run build
git add components/shared/Footer.tsx
git rm components/shared/Footer.module.css
git commit -m "refactor: migrate Footer to Tailwind"
```

---

### Task 10: TTSButton + Waveform 마이그레이션

**Files:**
- Modify: `components/shared/TTSButton.tsx`
- Delete: `components/shared/TTSButton.module.css`
- Modify: `components/shared/Waveform.tsx`
- Delete: `components/shared/Waveform.module.css`

- [ ] **Step 1: TTSButton.tsx Tailwind 전환**

핵심 스타일:
- `button`: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-light)] text-sm hover:bg-[var(--accent)]/20 transition-colors border border-[var(--accent)]/20`
- `loading`: `opacity-60 cursor-wait`
- `playing`: `shadow-[0_0_16px_var(--accent-glow)]`

- [ ] **Step 2: Waveform.tsx Tailwind 전환**

기존 bar 스타일을 inline style + Tailwind 조합으로 전환.
CSS 변수 `--min-h`, `--max-h`, `--dur` 는 inline style로 유지.

- [ ] **Step 3: CSS 파일 삭제**

```bash
rm components/shared/TTSButton.module.css components/shared/Waveform.module.css
```

- [ ] **Step 4: 빌드 검증 + 커밋**

```bash
npm run build
git add components/shared/TTSButton.tsx components/shared/Waveform.tsx
git rm components/shared/TTSButton.module.css components/shared/Waveform.module.css
git commit -m "refactor: migrate TTSButton + Waveform to Tailwind"
```

---

## Phase 3: 마케팅 랜딩 페이지 (8개 컴포넌트)

### Task 11: Hero 컴포넌트 마이그레이션

**Files:**
- Modify: `components/marketing/Hero.tsx`
- Delete: `components/marketing/Hero.module.css`

디자인 프리뷰에서 승인된 스타일 적용:
- SoundWaveBackground 배경
- Crimson Pro 세리프 히어로 텍스트
- 초록빛 발광 CTA 버튼

- [ ] **Step 1: Hero.tsx 재작성**

주요 변경:
- `import s from './Hero.module.css'` 제거
- `import { SoundWaveBackground } from '@/components/ui/sound-wave-bg'` 추가
- Hero 배경: SoundWaveBackground + gradient 오버레이
- 제목: `font-[family-name:var(--font-display)] text-[clamp(2.75rem,5vw,4rem)] font-light text-[var(--text-primary)] leading-[1.05] tracking-[-0.03em]`
- 강조 텍스트: `text-[var(--accent-light)]` + `textShadow: '0 0 30px rgba(80,180,120,0.4)'`
- CTA 버튼: `bg-[var(--accent)] text-white px-8 py-4 rounded-xl font-semibold shadow-[0_0_40px_var(--accent-glow)] hover:shadow-[0_0_60px_var(--accent-glow)]`

- [ ] **Step 2: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/marketing/Hero.module.css
npm run build
git add components/marketing/Hero.tsx
git rm components/marketing/Hero.module.css
git commit -m "refactor: migrate Hero to Tailwind + SoundWaveBackground"
```

---

### Task 12: Proof + Features + HowItWorks 마이그레이션

**Files:**
- Modify: `components/marketing/Proof.tsx`
- Delete: `components/marketing/Proof.module.css`
- Modify: `components/marketing/Features.tsx`
- Delete: `components/marketing/Features.module.css`
- Modify: `components/marketing/HowItWorks.tsx`
- Delete: `components/marketing/HowItWorks.module.css`

3개 컴포넌트 모두 동일 패턴: section + 카드 그리드.

- [ ] **Step 1: Proof.tsx Tailwind 전환**

Social proof 카운터 섹션.
- section: `py-20 border-b border-white/[0.06]`
- grid: `max-w-[1200px] mx-auto px-7 grid grid-cols-2 md:grid-cols-4 gap-8`
- stat: `text-center`
- number: `text-3xl font-mono font-bold text-[var(--accent-light)]` + textShadow glow
- label: `text-sm text-[var(--text-muted)] mt-1`

- [ ] **Step 2: Features.tsx Tailwind 전환**

Feature cards -> GlowCard 사용.
- grid: `grid grid-cols-1 md:grid-cols-3 gap-6`
- 각 카드: `<GlowCard className="p-6">` + lucide icon + 제목 + 설명

- [ ] **Step 3: HowItWorks.tsx Tailwind 전환**

Step cards -> GlowCard 사용.
- 번호: `text-5xl font-mono font-bold text-[var(--accent)]/20`
- 타이틀: `text-lg font-semibold text-[var(--text-primary)]`

- [ ] **Step 4: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/marketing/Proof.module.css components/marketing/Features.module.css components/marketing/HowItWorks.module.css
npm run build
git add components/marketing/Proof.tsx components/marketing/Features.tsx components/marketing/HowItWorks.tsx
git rm components/marketing/Proof.module.css components/marketing/Features.module.css components/marketing/HowItWorks.module.css
git commit -m "refactor: migrate Proof + Features + HowItWorks to Tailwind + GlowCard"
```

---

### Task 13: Demo + Pricing + Testimonials + CtaSection 마이그레이션

**Files:**
- Modify: `components/marketing/Demo.tsx`, `Pricing.tsx`, `Testimonials.tsx`, `CtaSection.tsx`
- Delete: 각각의 `.module.css` 4개

- [ ] **Step 1: Demo.tsx Tailwind 전환**

AI 데모 섹션. GlowCard 안에 데모 UI.

- [ ] **Step 2: Pricing.tsx Tailwind 전환**

4카드 요금제. GlowCard + `active` prop으로 추천 플랜 강조.
- 추천 카드: `<GlowCard active>` -- 상단 그린 라인 + 외부 발광
- 가격: `text-3xl font-mono font-bold text-[var(--text-primary)]`
- CTA 버튼: `bg-[var(--accent)] text-white rounded-lg py-2.5 font-medium`

- [ ] **Step 3: Testimonials.tsx Tailwind 전환**

후기 카드 -> GlowCard. 별점은 `text-[var(--streak-gold)]`.

- [ ] **Step 4: CtaSection.tsx Tailwind 전환**

최종 CTA. 큰 버튼 + glow 효과.
- 배경: gradient `from-[var(--accent)]/5 to-transparent`
- 버튼: `shadow-[0_0_60px_var(--accent-glow)] animate-[ctaGlow_3s_infinite]`

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/marketing/Demo.module.css components/marketing/Pricing.module.css components/marketing/Testimonials.module.css components/marketing/CtaSection.module.css
npm run build
git add components/marketing/Demo.tsx components/marketing/Pricing.tsx components/marketing/Testimonials.tsx components/marketing/CtaSection.tsx
git rm components/marketing/Demo.module.css components/marketing/Pricing.module.css components/marketing/Testimonials.module.css components/marketing/CtaSection.module.css
git commit -m "refactor: migrate Demo + Pricing + Testimonials + CTA to Tailwind"
```

---

## Phase 4: 대시보드 마이그레이션

### Task 14: Dashboard 3개 컴포넌트 + 페이지 마이그레이션

**Files:**
- Modify: `components/dashboard/ProgressCard.tsx`
- Delete: `components/dashboard/ProgressCard.module.css`
- Modify: `components/dashboard/TodayPractice.tsx`
- Delete: `components/dashboard/TodayPractice.module.css`
- Modify: `components/dashboard/GrowthChart.tsx`
- Delete: `components/dashboard/GrowthChart.module.css`
- Modify: `app/dashboard/DashboardClient.tsx`
- Delete: `app/dashboard/dashboard.module.css`

- [ ] **Step 1: ProgressCard.tsx Tailwind 전환**

기존 `Card` import -> `GlowCard` 사용. `ScoreDisplay` -> `ScoreRing`. `MetricBar` -> 신규 MetricBar.
- 카드 내부: `p-6 space-y-4`
- 진행률 바: MetricBar 컴포넌트 사용
- CTA 버튼: shadcn Button 또는 Tailwind 직접

- [ ] **Step 2: TodayPractice.tsx Tailwind 전환**

같은 패턴. GlowCard + Tailwind.

- [ ] **Step 3: GrowthChart.tsx Tailwind 전환**

차트 바 -> inline style + Tailwind. 색상: `var(--accent)`, `var(--accent-light)`, `var(--warning)`.

- [ ] **Step 4: DashboardClient.tsx Tailwind 전환**

```tsx
// styles import 제거, 레이아웃:
<div className="min-h-screen bg-[var(--bg-base)]">
  <Nav />
  <div className="max-w-[1200px] mx-auto px-7 pt-24 pb-16">
    <header className="mb-10">
      <h1 className="font-[family-name:var(--font-display)] text-[var(--fs-h1)] text-[var(--text-primary)]">
        대시보드
      </h1>
      <p className="text-[var(--text-secondary)] mt-2">
        보컬 트레이닝 현황을 한눈에 확인하세요
      </p>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ProgressCard />
      <TodayPractice />
    </div>
    <section className="mt-8">
      <GrowthChart />
    </section>
  </div>
</div>
```

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/dashboard/ProgressCard.module.css components/dashboard/TodayPractice.module.css components/dashboard/GrowthChart.module.css app/dashboard/dashboard.module.css
npm run build
git add components/dashboard/ app/dashboard/DashboardClient.tsx
git rm components/dashboard/ProgressCard.module.css components/dashboard/TodayPractice.module.css components/dashboard/GrowthChart.module.css app/dashboard/dashboard.module.css
git commit -m "refactor: migrate Dashboard to Tailwind + GlowCard"
```

---

## Phase 5: 소리의 길 (Journey) 마이그레이션

### Task 15: JourneyClient + StageCard 마이그레이션

**Files:**
- Modify: `app/journey/JourneyClient.tsx`
- Modify: `components/journey/StageCard.tsx` (currently uses ds/Card)

StageCard는 이미 일부 inline 스타일이지만, `Card` DS 컴포넌트 사용 -> GlowCard로 교체.

- [ ] **Step 1: StageCard.tsx를 GlowCard 기반으로 전환**

```tsx
import { GlowCard } from '@/components/ui/glow-card';

// Card import 제거, GlowCard로 교체
// active 상태 카드: <GlowCard active glow>
// locked 카드: <GlowCard className="opacity-40 pointer-events-none">
// default 카드: <GlowCard hover3d>
```

- [ ] **Step 2: JourneyClient.tsx Tailwind 전환**

블록별 그리드 레이아웃:
- 블록 제목: `font-[family-name:var(--font-display)] text-xl text-[var(--text-primary)]`
- 카드 그리드: `grid grid-cols-2 md:grid-cols-4 gap-4`

- [ ] **Step 3: 빌드 + 커밋**

```bash
npm run build
git add app/journey/JourneyClient.tsx components/journey/StageCard.tsx
git commit -m "refactor: migrate Journey page to Tailwind + GlowCard"
```

---

### Task 16: Journey Phase 컴포넌트 마이그레이션 (5개)

**Files:**
- Modify: `components/journey/phases/WhyPhase.tsx`
- Delete: `components/journey/phases/WhyPhase.module.css`
- Modify: `components/journey/phases/DemoPhase.tsx`
- Delete: `components/journey/phases/DemoPhase.module.css`
- Modify: `components/journey/phases/PracticePhase.tsx`
- Delete: `components/journey/phases/PracticePhase.module.css`
- Modify: `components/journey/phases/EvalPhase.tsx`
- Delete: `components/journey/phases/EvalPhase.module.css`
- Modify: `components/journey/phases/SummaryPhase.tsx`
- Delete: `components/journey/phases/SummaryPhase.module.css`

- [ ] **Step 1: WhyPhase.tsx Tailwind 전환**

GlowCard 배경, TTSButton, Tailwind 텍스트 스타일링.

- [ ] **Step 2: DemoPhase.tsx Tailwind 전환**

같은 패턴. TTS 재생 버튼 + 스크립트 표시.

- [ ] **Step 3: PracticePhase.tsx Tailwind 전환**

실시간 분석 UI. VoiceVisualizer + LiveFeedbackToast 사용.

- [ ] **Step 4: EvalPhase.tsx Tailwind 전환**

ScoreDisplay -> ScoreRing 교체. MetricBar -> 신규 MetricBar.

- [ ] **Step 5: SummaryPhase.tsx Tailwind 전환**

결과 카드 + 다음 단계 버튼.

- [ ] **Step 6: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/journey/phases/WhyPhase.module.css components/journey/phases/DemoPhase.module.css components/journey/phases/PracticePhase.module.css components/journey/phases/EvalPhase.module.css components/journey/phases/SummaryPhase.module.css
npm run build
git add components/journey/phases/
git commit -m "refactor: migrate 5 journey phases to Tailwind"
```

---

### Task 17: Journey 보조 컴포넌트 마이그레이션

**Files:**
- Modify: `components/journey/LessonProgress.tsx`
- Delete: `components/journey/LessonProgress.module.css`
- Modify: `components/journey/LiveFeedbackToast.tsx`
- Delete: `components/journey/LiveFeedbackToast.module.css`
- Modify: `components/journey/PaywallBanner.tsx`
- Delete: `components/journey/PaywallBanner.module.css`
- Modify: `components/journey/VoiceVisualizer.tsx`
- Delete: `components/journey/VoiceVisualizer.module.css`

- [ ] **Step 1: LessonProgress.tsx Tailwind 전환**

5단계 progress bar. 현재 단계: `bg-[var(--accent)]` + glow shadow.

- [ ] **Step 2: LiveFeedbackToast.tsx Tailwind 전환**

하단 고정 토스트: `fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border border-white/[0.06] rounded-xl px-4 py-3 shadow-lg`

- [ ] **Step 3: PaywallBanner.tsx Tailwind 전환**

잠금 배너: GlowCard + `bg-gradient-to-r from-[var(--accent)]/10 to-transparent`

- [ ] **Step 4: VoiceVisualizer.tsx Tailwind 전환**

Canvas 기반. Canvas 로직 유지, 래퍼만 Tailwind.

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/journey/LessonProgress.module.css components/journey/LiveFeedbackToast.module.css components/journey/PaywallBanner.module.css components/journey/VoiceVisualizer.module.css
npm run build
git add components/journey/
git commit -m "refactor: migrate journey helper components to Tailwind"
```

---

## Phase 6: 온보딩 마이그레이션

### Task 18: Onboarding 컴포넌트 마이그레이션 (6개 + 페이지)

**Files:**
- Modify: `components/onboarding/OnboardingWizard.tsx` + 5개 Step 컴포넌트
- Delete: 6개 `.module.css`
- Modify: `app/onboarding/OnboardingClient.tsx`
- Delete: `app/onboarding/onboarding.module.css`

- [ ] **Step 1: OnboardingWizard.tsx Tailwind 전환**

위저드 컨테이너 + step indicator:
- step dots: `flex gap-2` + 각 dot `w-2 h-2 rounded-full bg-white/[0.1]`
- active dot: `bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]`

- [ ] **Step 2: StepRecording.tsx Tailwind 전환**

녹음 버튼: `w-20 h-20 rounded-full bg-[var(--accent)] shadow-[0_0_40px_var(--accent-glow)] flex items-center justify-center`
녹음 중: 맥동 애니메이션 `animate-pulse`

- [ ] **Step 3: StepAnalyzing.tsx Tailwind 전환**

로딩 스피너 + 분석 중 텍스트.

- [ ] **Step 4: StepResult.tsx Tailwind 전환**

4축 분석 결과. MetricBar 사용.

- [ ] **Step 5: StepRoadmap.tsx + StepTransition.tsx Tailwind 전환**

로드맵 카드 -> GlowCard. 전환 화면 -> 간단한 CTA.

- [ ] **Step 6: OnboardingClient.tsx Tailwind 전환**

- [ ] **Step 7: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/onboarding/OnboardingWizard.module.css components/onboarding/StepAnalyzing.module.css components/onboarding/StepRecording.module.css components/onboarding/StepResult.module.css components/onboarding/StepRoadmap.module.css components/onboarding/StepTransition.module.css app/onboarding/onboarding.module.css
npm run build
git add components/onboarding/ app/onboarding/OnboardingClient.tsx
git commit -m "refactor: migrate Onboarding to Tailwind + GlowCard"
```

---

## Phase 7: Coach + Coaching 마이그레이션

### Task 19: Coach 컴포넌트 마이그레이션 (11개 + 페이지)

**Files:**
- Modify: `components/coach/` 11개 컴포넌트
- Delete: 11개 `.module.css`
- Modify: `app/coach/CoachPageClient.tsx`
- Delete: `app/coach/coach.module.css`

- [ ] **Step 1: ChatBox + ChatMessage + ChatInput Tailwind 전환**

ChatBox: `flex flex-col h-[calc(100vh-8rem)] bg-[var(--bg-base)]`
ChatMessage:
- user: `ml-auto max-w-[80%] bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl rounded-br-sm px-4 py-3`
- assistant: `mr-auto max-w-[80%] bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3`
ChatInput: `flex gap-2 p-4 border-t border-white/[0.06]` + `bg-[var(--bg-elevated)] rounded-xl`

- [ ] **Step 2: QuickChips.tsx Tailwind 전환**

칩 버튼: `px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent-light)] hover:border-[var(--accent)]/20 transition-colors`

- [ ] **Step 3: SessionSummary + ConditionCheck + JudgmentResult Tailwind 전환**

GlowCard 기반. ScoreRing + MetricBar 사용.

- [ ] **Step 4: LessonHome + LessonPlayer + PitchMonitor + ScaleDisplay Tailwind 전환**

- [ ] **Step 5: CoachPageClient.tsx Tailwind 전환**

- [ ] **Step 6: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/coach/ChatBox.module.css components/coach/ChatInput.module.css components/coach/ChatMessage.module.css components/coach/ConditionCheck.module.css components/coach/JudgmentResult.module.css components/coach/LessonHome.module.css components/coach/LessonPlayer.module.css components/coach/PitchMonitor.module.css components/coach/QuickChips.module.css components/coach/ScaleDisplay.module.css components/coach/SessionSummary.module.css app/coach/coach.module.css
npm run build
git add components/coach/ app/coach/
git commit -m "refactor: migrate Coach page to Tailwind"
```

---

### Task 20: Coaching 컴포넌트 마이그레이션 (4개 + 페이지)

**Files:**
- Modify: `components/coaching/` 4개 (CoachingChat, CoachingLayout, CurriculumTree, SessionInfo)
- Delete: 4개 `.module.css`
- Modify: `app/coaching/CoachingPageClient.tsx`
- Delete: `app/coaching/coaching.module.css`

- [ ] **Step 1: CoachingLayout + CurriculumTree Tailwind 전환**

사이드바 + 메인 레이아웃.
- sidebar: `w-72 bg-[var(--bg-raised)] border-r border-white/[0.06] h-screen overflow-y-auto`
- tree item active: `bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]`

- [ ] **Step 2: CoachingChat + SessionInfo Tailwind 전환**

- [ ] **Step 3: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/coaching/CoachingChat.module.css components/coaching/CoachingLayout.module.css components/coaching/CurriculumTree.module.css components/coaching/SessionInfo.module.css app/coaching/coaching.module.css
npm run build
git add components/coaching/ app/coaching/
git commit -m "refactor: migrate Coaching page to Tailwind"
```

---

## Phase 8: Practice 페이지 마이그레이션 (14개 컴포넌트)

### Task 21: Practice 컴포넌트 마이그레이션

**Files:**
- Modify: `components/practice/` 14개 컴포넌트
- Delete: 14개 `.module.css`
- Modify: `app/practice/PracticePageClient.tsx`
- Delete: `app/practice/practice.module.css`

이 태스크는 규모가 크므로 단계별로 나눈다.

- [ ] **Step 1: SongList + SongUploader Tailwind 전환**

곡 목록 + 업로드. GlowCard + 파일 드롭존.

- [ ] **Step 2: PlayMode + PracticePlayer + ModeSwitcher Tailwind 전환**

재생 컨트롤. 커스텀 슬라이더 -> Tailwind range 또는 inline style.

- [ ] **Step 3: PitchDisplay + PitchTimeline Tailwind 전환**

Canvas 기반 피치 시각화. Canvas 유지, 래퍼만 Tailwind.

- [ ] **Step 4: LyricsPanel + LoopControls + SectionTabs Tailwind 전환**

가사 패널, 구간 반복 컨트롤, 섹션 탭.

- [ ] **Step 5: KeyRecommender + PronunciationView + SessionResult + VocalMap Tailwind 전환**

- [ ] **Step 6: PracticePageClient.tsx Tailwind 전환**

- [ ] **Step 7: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/practice/KeyRecommender.module.css components/practice/LoopControls.module.css components/practice/LyricsPanel.module.css components/practice/ModeSwitcher.module.css components/practice/PitchDisplay.module.css components/practice/PitchTimeline.module.css components/practice/PlayMode.module.css components/practice/PracticePlayer.module.css components/practice/PronunciationView.module.css components/practice/SectionTabs.module.css components/practice/SessionResult.module.css components/practice/SongList.module.css components/practice/SongUploader.module.css components/practice/VocalMap.module.css app/practice/practice.module.css
npm run build
git add components/practice/ app/practice/
git commit -m "refactor: migrate Practice page to Tailwind"
```

---

## Phase 9: 나머지 페이지 마이그레이션

### Task 22: Breathing 마이그레이션 (4개 + 페이지)

**Files:**
- Modify: `components/breathing/` 4개
- Delete: 4개 `.module.css`
- Modify: `app/breathing/BreathingPageClient.tsx`
- Delete: `app/breathing/breathing.module.css`

- [ ] **Step 1: BreathVisualizer Tailwind 전환**

Canvas/SVG 기반 호흡 원. Canvas 유지, 래퍼 Tailwind.

- [ ] **Step 2: BreathTimer Tailwind 전환**

타이머 표시: `font-mono text-5xl text-[var(--accent-light)]` + glow textShadow.

- [ ] **Step 3: ModeSelector Tailwind 전환**

모드 버튼 그룹: `flex gap-2` + selected `bg-[var(--accent)] text-white`.

- [ ] **Step 4: WeeklyChart Tailwind 전환**

주간 차트 바.

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/breathing/BreathTimer.module.css components/breathing/BreathVisualizer.module.css components/breathing/ModeSelector.module.css components/breathing/WeeklyChart.module.css app/breathing/breathing.module.css
npm run build
git add components/breathing/ app/breathing/
git commit -m "refactor: migrate Breathing page to Tailwind"
```

---

### Task 23: Warmup 마이그레이션 (4개 + 페이지)

**Files:**
- Modify: `components/warmup/` 4개
- Delete: 4개 `.module.css`
- Modify: `app/warmup/WarmupPageClient.tsx`
- Delete: `app/warmup/warmup.module.css`

- [ ] **Step 1: ConditionForm Tailwind 전환**

폼 요소 -> GlowCard + input 스타일: `bg-[var(--bg-elevated)] border border-white/[0.06] rounded-lg px-4 py-3`

- [ ] **Step 2: ExercisePlayer Tailwind 전환**

- [ ] **Step 3: RoutineView + RoutineHistory Tailwind 전환**

- [ ] **Step 4: WarmupPageClient.tsx Tailwind 전환**

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/warmup/ConditionForm.module.css components/warmup/ExercisePlayer.module.css components/warmup/RoutineHistory.module.css components/warmup/RoutineView.module.css app/warmup/warmup.module.css
npm run build
git add components/warmup/ app/warmup/
git commit -m "refactor: migrate Warmup page to Tailwind"
```

---

### Task 24: Diagnosis 마이그레이션 (4개 + 페이지)

**Files:**
- Modify: `components/diagnosis/` 4개
- Delete: 4개 `.module.css`
- Modify: `app/diagnosis/DiagnosisPageClient.tsx`
- Delete: `app/diagnosis/diagnosis.module.css`

- [ ] **Step 1: DiagnosisWizard Tailwind 전환**

위저드 UI. 온보딩과 유사한 step indicator 패턴.

- [ ] **Step 2: DiagnosisResult Tailwind 전환**

ScoreRing + MetricBar 사용.

- [ ] **Step 3: BarChart + StepSelfEval Tailwind 전환**

BarChart: Tailwind bar + inline height.
StepSelfEval: 슬라이더/라디오 폼.

- [ ] **Step 4: DiagnosisPageClient.tsx Tailwind 전환**

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/diagnosis/BarChart.module.css components/diagnosis/DiagnosisResult.module.css components/diagnosis/DiagnosisWizard.module.css components/diagnosis/StepSelfEval.module.css app/diagnosis/diagnosis.module.css
npm run build
git add components/diagnosis/ app/diagnosis/
git commit -m "refactor: migrate Diagnosis page to Tailwind"
```

---

### Task 25: AI Cover 마이그레이션 (3+7 컴포넌트 + 페이지)

**Files:**
- Modify: `components/ai-cover/` 3개 (AudioPlayer, AudioRecorder, FileDropZone)
- Delete: 3개 `.module.css`
- Modify: `app/ai-cover/` CSS files (AiCoverClient, VocalReport, + 5 sub-components)
- Delete: 9개 `.module.css` total (app 디렉토리 포함)

- [ ] **Step 1: AudioPlayer + AudioRecorder + FileDropZone Tailwind 전환**

FileDropZone: `border-2 border-dashed border-white/[0.10] rounded-xl p-8 text-center hover:border-[var(--accent)]/30 transition-colors`

- [ ] **Step 2: AiCoverClient + VocalReportClient Tailwind 전환**

- [ ] **Step 3: Step 컴포넌트 (ConvertStep, DemoSection, ModelStep, RecordStep, ResultStep, StepIndicator, UsageCounter) Tailwind 전환**

StepIndicator: `flex gap-2` + active `bg-[var(--accent)]`

- [ ] **Step 4: CSS 삭제 + 빌드 + 커밋**

```bash
rm components/ai-cover/AudioPlayer.module.css components/ai-cover/AudioRecorder.module.css components/ai-cover/FileDropZone.module.css app/ai-cover/AiCoverClient.module.css app/ai-cover/VocalReport.module.css app/ai-cover/components/ConvertStep.module.css app/ai-cover/components/DemoSection.module.css app/ai-cover/components/ModelStep.module.css app/ai-cover/components/RecordStep.module.css app/ai-cover/components/ResultStep.module.css app/ai-cover/components/StepIndicator.module.css app/ai-cover/components/UsageCounter.module.css
npm run build
git add components/ai-cover/ app/ai-cover/
git commit -m "refactor: migrate AI Cover page to Tailwind"
```

---

### Task 26: Auth + Pricing + Payment + Feedback + Teacher 마이그레이션

**Files:**
- Modify + Delete CSS:
  - `app/auth/auth.module.css` (login + signup 페이지 공유)
  - `app/pricing/PricingClient.tsx` (별도 페이지)
  - `app/checkout/[plan]/checkout.module.css`
  - `app/payment/success/success.module.css`
  - `app/payment/fail/fail.module.css`
  - `app/feedback-request/FeedbackRequest.module.css`
  - `app/teacher/teacher.module.css`

- [ ] **Step 1: Auth 페이지 Tailwind 전환**

로그인/회원가입 폼.
- 폼 카드: `<GlowCard className="max-w-md mx-auto p-8">`
- input: `w-full bg-[var(--bg-elevated)] border border-white/[0.06] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-colors`
- submit: `w-full bg-[var(--accent)] text-white py-3 rounded-lg font-medium hover:bg-[var(--accent-hover)] shadow-[0_0_20px_var(--accent-glow)]`

- [ ] **Step 2: Checkout + Payment Success/Fail Tailwind 전환**

- [ ] **Step 3: FeedbackRequest + Teacher Tailwind 전환**

- [ ] **Step 4: PricingClient.tsx Tailwind 전환** (marketing/Pricing와 유사하지만 독립 페이지)

- [ ] **Step 5: CSS 삭제 + 빌드 + 커밋**

```bash
rm app/auth/auth.module.css app/checkout/*/checkout.module.css app/payment/success/success.module.css app/payment/fail/fail.module.css app/feedback-request/FeedbackRequest.module.css app/teacher/teacher.module.css
npm run build
git add app/auth/ app/checkout/ app/payment/ app/feedback-request/ app/teacher/ app/pricing/
git commit -m "refactor: migrate Auth + Payment + Misc pages to Tailwind"
```

---

### Task 27: Scale Practice 페이지 마이그레이션

**Files:**
- Modify: `components/scale-practice/` 컴포넌트들
- Modify: `app/scale-practice/[stageId]/ScalePracticeClient.tsx`

스케일 연습 페이지의 기존 inline style 색상을 그린 테마로 조정.

- [ ] **Step 1: 스케일 연습 관련 컴포넌트 색상 교체**

기존 crimson/gold 색상 참조를 `var(--accent)` 계열로 교체.

- [ ] **Step 2: 빌드 + 커밋**

```bash
npm run build
git add components/scale-practice/ app/scale-practice/
git commit -m "refactor: update Scale Practice colors to forest green"
```

---

## Phase 10: 정리 + 검증

### Task 28: 기존 DS 컴포넌트 제거 + import 교체

**Files:**
- Delete: `components/ds/Button.tsx` + `Button.module.css`
- Delete: `components/ds/Card.tsx` + `Card.module.css`
- Delete: `components/ds/MetricBar.tsx` + `MetricBar.module.css`
- Delete: `components/ds/NavBar.tsx` + `NavBar.module.css`
- Delete: `components/ds/ScoreDisplay.tsx` + `ScoreDisplay.module.css`
- Modify: 기존 DS 컴포넌트를 import하는 모든 파일

**주의:** 이 태스크는 반드시 모든 페이지 마이그레이션 완료 후 실행.

- [ ] **Step 1: DS 컴포넌트 사용처 검색**

```bash
grep -r "from '@/components/ds/" --include="*.tsx" --include="*.ts" -l
```

각 파일에서 import를 신규 컴포넌트로 교체:
- `ds/Button` -> shadcn `Button` (`@/components/ui/button`) 또는 Tailwind 직접
- `ds/Card` -> `GlowCard` (`@/components/ui/glow-card`)
- `ds/MetricBar` -> `MetricBar` (`@/components/ui/metric-bar`)
- `ds/ScoreDisplay` -> `ScoreRing` (`@/components/ui/score-ring`)
- `ds/NavBar` -> Nav 이미 마이그레이션됨

- [ ] **Step 2: DS 디렉토리 삭제**

```bash
rm -rf components/ds/
```

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```

- [ ] **Step 4: 커밋**

```bash
git rm -r components/ds/
git commit -m "refactor: remove legacy ds/ design system components"
```

---

### Task 29: CSS Module 잔여 파일 확인 + 삭제

**Files:**
- 전체 `.module.css` 검색

- [ ] **Step 1: 잔여 .module.css 검색**

```bash
find . -name "*.module.css" -not -path "./.next/*" -not -path "./node_modules/*"
```

Expected: 0개. 남은 파일이 있으면 해당 컴포넌트에서 import 제거 후 파일 삭제.

- [ ] **Step 2: 잔여 CSS Module import 검색**

```bash
grep -r "\.module\.css" --include="*.tsx" --include="*.ts" -l
```

Expected: 0개.

- [ ] **Step 3: 잔여 파일 삭제 + 빌드 + 커밋**

```bash
npm run build
git add -A
git commit -m "refactor: remove all remaining CSS Module files"
```

---

### Task 30: 라이트 모드 검증 + globals.css 라이트 토큰 조정

**Files:**
- Modify: `app/globals.css` (필요 시)

- [ ] **Step 1: 라이트 모드에서 전체 페이지 브라우저 확인**

dev 서버 실행 후 ThemeToggle로 라이트 모드 전환.
모든 주요 페이지 순회:
- `/` (랜딩)
- `/dashboard`
- `/journey`
- `/coach`
- `/onboarding`

- [ ] **Step 2: 라이트 모드 CSS 변수 조정**

문제가 있는 페이지의 색상 대비 확인. 필요시 globals.css에 라이트 모드 토큰 추가:

```css
.light {
  --bg-base: #F6F8F7;
  --bg-raised: #FFFFFF;
  --bg-elevated: #F0F2F1;
  --text-primary: #1A2420;
  --text-secondary: #5A6A60;
  --text-muted: #8A9A90;
  --accent: #4A7A5D;
  --accent-light: #5B8C6E;
  --border-subtle: rgba(0,0,0,0.06);
  --border-default: rgba(0,0,0,0.10);
  --border-strong: rgba(0,0,0,0.16);
}
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
npm run build
git add app/globals.css
git commit -m "feat: tune light mode color tokens"
```

---

### Task 31: 반응형 검증 (375px ~ 1440px)

- [ ] **Step 1: 모바일(375px) 전 페이지 Playwright 스크린샷**

```bash
npx playwright screenshot --viewport-size=375,812 http://localhost:3000 screenshots/mobile-landing.png
npx playwright screenshot --viewport-size=375,812 http://localhost:3000/journey screenshots/mobile-journey.png
npx playwright screenshot --viewport-size=375,812 http://localhost:3000/dashboard screenshots/mobile-dashboard.png
```

- [ ] **Step 2: 데스크톱(1440px) 전 페이지 스크린샷**

```bash
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000 screenshots/desktop-landing.png
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/journey screenshots/desktop-journey.png
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/dashboard screenshots/desktop-dashboard.png
```

- [ ] **Step 3: 레이아웃 깨짐 수정 (있으면)**

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "fix: responsive layout adjustments"
```

---

### Task 32: 최종 빌드 검증 + 정리

- [ ] **Step 1: 최종 프로덕션 빌드**

```bash
npm run build
```

Expected: 에러/경고 0개.

- [ ] **Step 2: design-preview 페이지 제거**

```bash
rm -rf app/design-preview/
```

middleware.ts의 PUBLIC_PATHS에서 `/design-preview` 제거.

- [ ] **Step 3: 사용하지 않는 globals.css 레거시 alias 정리**

`.module.css`가 모두 삭제되었으므로, 레거시 alias 중 미사용 확인 후 제거.

```bash
grep -r "var(--gold)" --include="*.tsx" --include="*.ts" --include="*.css" -l
```

미사용 변수 제거.

- [ ] **Step 4: CLAUDE.md 업데이트**

Code Style 섹션에서:
- `CSS: CSS Modules (.module.css) + globals.css 변수` -> `CSS: Tailwind v4 + shadcn/ui + globals.css 토큰`
- Anti-patterns에 추가: `- CSS Modules 신규 생성 금지 -- Tailwind 사용`

- [ ] **Step 5: 최종 커밋**

```bash
npm run build
git add -A
git commit -m "refactor: complete UI redesign - deep forest green + shadcn/ui + Tailwind"
```

---

## 요약

| Phase | 태스크 | CSS Module 삭제 수 | 설명 |
|-------|--------|-------------------|------|
| 1 | Task 1~7 | 0 | Foundation (테마, 토큰, 핵심 컴포넌트) |
| 2 | Task 8~10 | 4 | 공통 컴포넌트 (Nav, Footer, TTSButton, Waveform) |
| 3 | Task 11~13 | 8 | 마케팅 랜딩 (Hero~CTA 8개) |
| 4 | Task 14 | 4 | 대시보드 (3+1개) |
| 5 | Task 15~17 | 9 | 소리의 길 (StageCard + 5Phase + 4보조) |
| 6 | Task 18 | 7 | 온보딩 (6+1개) |
| 7 | Task 19~20 | 16 | Coach + Coaching (11+4+2개) |
| 8 | Task 21 | 15 | Practice (14+1개) |
| 9 | Task 22~27 | 34 | 나머지 페이지 |
| 10 | Task 28~32 | 5 (ds/) | 정리 + 검증 |
| **합계** | **32 태스크** | **102** | **전체 CSS Module 교체 완료** |
