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
            'border-t-2 border-t-[var(--accent)]/60',
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
