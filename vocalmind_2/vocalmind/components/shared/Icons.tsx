interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

const d = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function I({ size = 24, className, color, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={d.viewBox}
      fill={d.fill}
      stroke={color || d.stroke}
      strokeWidth={d.strokeWidth}
      strokeLinecap={d.strokeLinecap}
      strokeLinejoin={d.strokeLinejoin}
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconMic(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </I>
  );
}

export function IconChart(p: IconProps) {
  return (
    <I {...p}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </I>
  );
}

export function IconBot(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <I {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </I>
  );
}

export function IconMusic(p: IconProps) {
  return (
    <I {...p}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </I>
  );
}

export function IconLock(p: IconProps) {
  return (
    <I {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </I>
  );
}

export function IconTarget(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </I>
  );
}

export function IconTrophy(p: IconProps) {
  return (
    <I {...p}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </I>
  );
}

export function IconStar(p: IconProps) {
  return (
    <I {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </I>
  );
}

export function IconUser(p: IconProps) {
  return (
    <I {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </I>
  );
}

export function IconSend(p: IconProps) {
  return (
    <I {...p}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </I>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <I {...p}>
      <polyline points="20 6 9 17 4 12" />
    </I>
  );
}

export function IconX(p: IconProps) {
  return (
    <I {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </I>
  );
}

export function IconChat(p: IconProps) {
  return (
    <I {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </I>
  );
}

export function IconZap(p: IconProps) {
  return (
    <I {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </I>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <I {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </I>
  );
}

export function IconYoutube(p: IconProps) {
  return (
    <I {...p}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </I>
  );
}

export function IconInstagram(p: IconProps) {
  return (
    <I {...p}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconTiktok(p: IconProps) {
  return (
    <I {...p}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </I>
  );
}

export function IconTwitter(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M20 4l-6.768 6.768" />
    </I>
  );
}

export function IconRocket(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </I>
  );
}

export function IconWind(p: IconProps) {
  return (
    <I {...p}>
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </I>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <I {...p}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </I>
  );
}

export function IconFrown(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </I>
  );
}

export function IconNervous(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 15h8" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </I>
  );
}

export function IconVibrato(p: IconProps) {
  return (
    <I {...p}>
      <path d="M2 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0" />
    </I>
  );
}

export function IconTheater(p: IconProps) {
  return (
    <I {...p}>
      <path d="M2 10s3-3 5-3 5 3 5 3" />
      <path d="M12 10s3-3 5-3 5 3 5 3" />
      <path d="M2 10s3 4 5 4 5-4 5-4" />
      <path d="M12 10s3 4 5 4 5-4 5-4" />
      <line x1="5" y1="18" x2="5" y2="22" />
      <line x1="19" y1="18" x2="19" y2="22" />
      <path d="M5 18a7 7 0 0 0 14 0" />
    </I>
  );
}

export function IconGuitar(p: IconProps) {
  return (
    <I {...p}>
      <path d="m20 4-1.5 1.5" />
      <path d="m18.5 5.5-3 3" />
      <path d="m15.5 8.5-1.23 1.23a3 3 0 0 0-.67 1.2l-.38 1.26a1 1 0 0 1-.7.7l-1.26.38a3 3 0 0 0-1.2.67L9 15" />
      <path d="M9 15a4 4 0 1 1-4.5 4.5" />
      <path d="m4.5 19.5.5-.5" />
    </I>
  );
}

export function IconSax(p: IconProps) {
  return (
    <I {...p}>
      <path d="M14 2v4" />
      <path d="M14 6c0 1-2 3-2 3l-5 7a4 4 0 1 0 6 4" />
      <circle cx="10" cy="20" r="1" fill="currentColor" stroke="none" />
      <path d="M16 6h-2" />
    </I>
  );
}

export function IconSheet(p: IconProps) {
  return (
    <I {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </I>
  );
}
