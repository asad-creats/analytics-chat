import type { ReactNode } from 'react';

/** Stroke icons drawn for Pipeline. Each keeps the view box it was drawn on. */
const icons = {
  plus: { box: 16, stroke: 1.5, body: <path d="M8 3v10M3 8h10" /> },
  ask: { box: 16, stroke: 1.5, body: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /> },
  board: {
    box: 16,
    stroke: 1.5,
    body: (
      <>
        <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
        <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
        <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
        <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
      </>
    ),
  },
  send: { box: 18, stroke: 1.75, body: <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" /> },
  chevronDown: { box: 14, stroke: 1.5, body: <path d="M3.5 5.5l3.5 3.5 3.5-3.5" /> },
  chevronRight: { box: 14, stroke: 1.5, body: <path d="M5.5 3.5L9 7l-3.5 3.5" /> },
  caretDown: { box: 12, stroke: 1.5, body: <path d="M3 4.5l3 3 3-3" /> },
  forward: { box: 16, stroke: 1.5, body: <path d="M6 3.5L10.5 8 6 12.5" /> },
  back: { box: 20, stroke: 1.75, body: <path d="M12.5 4.5L7 10l5.5 5.5" /> },
  arrowRight: { box: 16, stroke: 1.6, body: <path d="M3 8h10M9 4l4 4-4 4" /> },
  clock: {
    box: 14,
    stroke: 1.25,
    body: (
      <>
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 4v3l2 1.5" />
      </>
    ),
  },
  pin: { box: 14, stroke: 1.4, body: <path d="M5 1.5h4l-.5 4 2 2v1H3.5v-1l2-2zM7 8.5v4" /> },
  pinFilled: {
    box: 14,
    stroke: 1.4,
    body: (
      <>
        <path d="M5 1.5h4l-.5 4 2 2v1H3.5v-1l2-2z" fill="currentColor" />
        <path d="M7 8.5v4" />
      </>
    ),
  },
  share: { box: 14, stroke: 1.4, body: <path d="M7 9V1.5M4 4.5l3-3 3 3M2 8v4h10V8" /> },
  copy: {
    box: 12,
    stroke: 1.25,
    body: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
        <path d="M1.5 8V1.5H8" />
      </>
    ),
  },
  refresh: { box: 14, stroke: 1.4, body: <path d="M12 7a5 5 0 1 1-1.5-3.5M12 1.5v3h-3" /> },
  info: {
    box: 16,
    stroke: 1.4,
    body: (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7v4M8 5v.01" />
      </>
    ),
  },
  error: {
    box: 20,
    stroke: 1.6,
    body: (
      <>
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v5M10 13.5v.01" />
      </>
    ),
  },
  warning: {
    box: 14,
    stroke: 1.4,
    body: (
      <>
        <path d="M7 1.5l6 10.5H1z" />
        <path d="M7 5.5v3M7 10v.01" />
      </>
    ),
  },
  check: { box: 16, stroke: 1.75, body: <path d="M3.5 8.5l3 3 6-7" /> },
  pending: { box: 16, stroke: 1.5, body: <circle cx="8" cy="8" r="5.5" /> },
  sliders: {
    box: 16,
    stroke: 1.5,
    body: (
      <>
        <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
        <circle cx="10" cy="4.5" r="1.5" />
        <circle cx="6" cy="11.5" r="1.5" />
      </>
    ),
  },
  mic: {
    box: 18,
    stroke: 1.5,
    body: (
      <>
        <rect x="6.5" y="2" width="5" height="9" rx="2.5" />
        <path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5" />
      </>
    ),
  },
} satisfies Record<string, { box: number; stroke: number; body: ReactNode }>;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size, className }: IconProps) {
  const icon = icons[name];
  const px = size ?? icon.box;
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${icon.box} ${icon.box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.stroke}
      aria-hidden="true"
      className={className}
      style={{ flex: 'none' }}
    >
      {icon.body}
    </svg>
  );
}

/** The Pipeline mark: rising bars on an accent tile. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="24" height="24" rx="6" style={{ fill: 'var(--accent)' }} />
      <rect x="6" y="13" width="3" height="5" rx="1" style={{ fill: 'var(--on-accent)' }} />
      <rect x="10.5" y="9" width="3" height="9" rx="1" style={{ fill: 'var(--on-accent)' }} />
      <rect x="15" y="6" width="3" height="12" rx="1" style={{ fill: 'var(--on-accent)' }} />
    </svg>
  );
}

/** The spinner used while an answer step is running. */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="spin">
      <circle cx="8" cy="8" r="6" style={{ stroke: 'var(--border)' }} strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
