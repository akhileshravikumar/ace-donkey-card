/** Small inline icons from the wireframes. All decorative (aria-hidden); controls carry labels. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function CopyIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
      {...props}
    >
      <path d="M2 2h12v19H2z" strokeLinejoin="round" />
      <path d="M5 7h6M5 11h6M5 15h6" strokeLinecap="round" />
      <path d="M10 21v7h12V9h-8" strokeLinejoin="round" />
    </svg>
  );
}

/** The small crown next to the host's name in lists. */
export function CrownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 26 18" fill="currentColor" aria-hidden {...props}>
      <path d="M1 3l6 6 6-8 6 8 6-6-2 14H3z" />
    </svg>
  );
}

export function DragHandleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 26" fill="currentColor" aria-hidden {...props}>
      {[3, 13, 23].flatMap((y) =>
        [4, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.8" />),
      )}
    </svg>
  );
}

export function RemoveIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M4 4l12 12M16 4L4 16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M4 4l12 12M16 4L4 16" />
    </svg>
  );
}

/** Two people: the "waiting players" button. */
export function WaitingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <circle cx="9" cy="7" r="3.2" />
      <path d="M3 20c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5z" />
      <circle cx="16.5" cy="9" r="2.6" opacity=".75" />
      <path d="M13.5 20c.2-3 1-5 3-5.6 2.6.2 4.5 2.4 4.5 5.6z" opacity=".75" />
    </svg>
  );
}

/** Map pin shown above the player whose turn it is. */
export function TurnPin(props: IconProps) {
  return (
    <svg viewBox="0 0 20 26" fill="currentColor" aria-hidden {...props}>
      <path d="M10 26S0 14.5 0 9.5a10 10 0 0120 0C20 14.5 10 26 10 26z" />
    </svg>
  );
}

export function CardOutlineIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 16" aria-hidden {...props}>
      <rect x="1" y="1" width="10" height="14" rx="1.5" fill="white" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 72 72" fill="currentColor" aria-hidden {...props}>
      <path d="M16 4h40v6h12c0 14-7 22-16 23-3 7-8 10-12 11v10h10v8H22v-8h10V44c-4-1-9-4-12-11C11 32 4 24 4 10h12zm0 13H11c1 7 4 10 7 11-1-3-2-7-2-11zm40 0c0 4-1 8-2 11 3-1 6-4 7-11z" />
      <rect x="18" y="62" width="36" height="8" rx="1" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 3l10 11L3 25" />
    </svg>
  );
}

const SUIT_PATHS = {
  S: 'M12 1C8 7 2 9.5 2 14.5a4.6 4.6 0 008.4 2.6L9 22h6l-1.4-4.9A4.6 4.6 0 0022 14.5C22 9.5 16 7 12 1z',
  C: 'M12 2a4.6 4.6 0 00-3.9 7A4.6 4.6 0 1010.6 16L9 22h6l-1.6-6A4.6 4.6 0 1015.9 9 4.6 4.6 0 0012 2z',
  D: 'M12 1l9 11-9 11-9-11z',
  H: 'M12 22S2 15 2 8.3A5.3 5.3 0 0112 5.6a5.3 5.3 0 0110 2.7C22 15 12 22 12 22z',
} as const;

export function SuitIcon({ suit, ...props }: IconProps & { suit: keyof typeof SUIT_PATHS }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d={SUIT_PATHS[suit]} />
    </svg>
  );
}
