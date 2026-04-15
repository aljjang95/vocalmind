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
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }, []);
  return createRipple;
}
