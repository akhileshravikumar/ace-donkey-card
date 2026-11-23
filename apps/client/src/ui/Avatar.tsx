/**
 * The player face from the wireframes: a grey head (one of 6 face colours) with two dot eyes, one
 * of 4 glasses and one of 3 mouths (R25), and optionally a crown — spiky for the host, dotted for
 * the last game's loser.
 *
 * Drawn in head-radius units (head r = 34); glasses and crowns overflow the head on purpose.
 */
import type { CSSProperties } from 'react';
import type { Avatar as AvatarData } from '@ace/shared';

export type CrownKind = 'host' | 'loser' | null;

const STROKE = '#000';
const EYE_Y = -4;
/** Eyes sit in the middle of each lens, so their spacing follows the glasses (indexes match AVATAR_GLASSES). */
const EYE_X = [18, 25, 26, 20];

function Glasses({ kind }: { kind: number }) {
  switch (kind) {
    case 0: // small square
      return (
        <g fill="none" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round">
          <rect x={-27} y={-12.5} width={18} height={17} rx={4} />
          <rect x={9} y={-12.5} width={18} height={17} rx={4} />
          <path d="M-9 -4 H9" />
        </g>
      );
    case 1: // round
      return (
        <g fill="none" stroke={STROKE} strokeWidth={2.8}>
          <circle cx={-25} cy={EYE_Y} r={15.5} />
          <circle cx={25} cy={EYE_Y} r={15.5} />
          <path d="M-9.5 -5 Q0 -11 9.5 -5" />
        </g>
      );
    case 2: // wide rectangle
      return (
        <g fill="none" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round">
          <rect x={-42} y={-11} width={32} height={14} rx={3} />
          <rect x={10} y={-11} width={32} height={14} rx={3} />
          <path d="M-10 -4 H10" />
        </g>
      );
    default: // none
      return null;
  }
}

function Mouth({ kind }: { kind: number }) {
  switch (kind) {
    case 0: // line with two teeth
      return (
        <g fill="none" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M-9 15 H9" strokeLinecap="round" />
          <path d="M-5 15 V18 Q-5 21 -2.5 21 Q0 21 0 18 V15 M0 18 Q0 21 2.5 21 Q5 21 5 18 V15" />
        </g>
      );
    case 1: // O
      return <circle cx={0} cy={19} r={4.5} fill="none" stroke={STROKE} strokeWidth={1.8} />;
    default: // flat
      return (
        <path d="M-7 18 H7" fill="none" stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" />
      );
  }
}

function Crown({ kind }: { kind: Exclude<CrownKind, null> }) {
  if (kind === 'host')
    return (
      <path
        data-crown="host"
        d="M-28 -34 L-31 -52 L-15 -41 L0 -57 L15 -41 L31 -52 L28 -34 Q0 -41 -28 -34 Z"
        fill={STROKE}
      />
    );
  return (
    <g data-crown="loser" fill={STROKE} stroke={STROKE} strokeLinecap="round">
      <path d="M-30 -42 Q0 -30 30 -42" fill="none" strokeWidth={4} />
      <path d="M-22 -38 L-31 -47 M0 -35 V-50 M22 -38 L31 -47" fill="none" strokeWidth={2.4} />
      <circle cx={-32} cy={-48} r={3.4} stroke="none" />
      <circle cx={0} cy={-52} r={3.4} stroke="none" />
      <circle cx={32} cy={-48} r={3.4} stroke="none" />
    </g>
  );
}

/**
 * `size` is the head diameter in wireframe pixels (e.g. 68 in the lobby list). Purely visual:
 * the player's name is always shown or announced next to it.
 */
export function Avatar({
  avatar,
  size,
  crown = null,
  className,
  style,
}: {
  avatar: AvatarData;
  size: number;
  crown?: CrownKind;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="-34 -34 68 68"
      aria-hidden
      data-avatar={`${avatar.face}${avatar.glasses}${avatar.mouth}`}
      className={className}
      style={{
        width: `calc(var(--u) * ${size})`,
        height: `calc(var(--u) * ${size})`,
        overflow: 'visible',
        ...style,
      }}
    >
      <circle r={34} fill={faceColour(avatar.face)} />
      {[-1, 1].map((side) => (
        <circle
          key={side}
          cx={side * (EYE_X[avatar.glasses] ?? 22)}
          cy={EYE_Y}
          r={2.6}
          fill={STROKE}
        />
      ))}
      <Glasses kind={avatar.glasses} />
      <Mouth kind={avatar.mouth} />
      {crown && <Crown kind={crown} />}
    </svg>
  );
}

/** The face colour token for a swatch index (greys for now; see index.css). */
export function faceColour(face: number): string {
  return `var(--color-face-${face})`;
}

/** Just the glasses or the mouth, for the Customize carousel's side options. */
export function AvatarPart({
  part,
  index,
  className,
  style,
}: {
  part: 'glasses' | 'mouth';
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox={part === 'glasses' ? '-45 -16 90 24' : '-12 12 24 12'}
      aria-hidden
      className={className}
      style={style}
      overflow="visible"
    >
      {part === 'glasses' ? <Glasses kind={index} /> : <Mouth kind={index} />}
    </svg>
  );
}
