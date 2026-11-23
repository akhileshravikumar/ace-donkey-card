import { useId, useState } from 'react';
import {
  AVATAR_FACE_COUNT,
  AVATAR_GLASSES,
  AVATAR_MOUTHS,
  type Avatar as AvatarData,
} from '@ace/shared';
import { cycle } from '../lib/avatar';
import { useGame } from '../state/context';
import { Avatar, AvatarPart, faceColour } from '../ui/Avatar';
import { Dialog } from '../ui/Modal';
import { cn } from '../ui/cn';
import { ChevronRightIcon } from '../ui/icons';

const GLASSES_NAMES = ['Small square glasses', 'Round glasses', 'Wide glasses', 'No glasses'];
const MOUTH_NAMES = ['Teeth', 'O mouth', 'Straight mouth'];

// Layout in wireframe pixels: the avatar sits over both rows, its glasses on the glasses row and
// its mouth on the mouth row.
const STAGE_W = 602;
const STAGE_H = 140;
const AVATAR = 136;
const GLASSES_ROW = { y: 62, width: 520, height: 47 };
const MOUTH_ROW = { y: 108, width: 432, height: 27 };
const ARROW_X = [13, 589];
const SIDE_X = [133, 469];

/**
 * Customize (R25): six face colours, then arrows to step through the glasses and the mouths. The
 * row shows the previous and next option either side of the avatar. Done saves, Exit discards.
 */
export function CustomizeModal({ onClose }: { onClose(): void }) {
  const current = useGame((s) => s.avatar);
  const setAvatar = useGame((s) => s.setAvatar);
  const [draft, setDraft] = useState<AvatarData>(current);
  const titleId = useId();

  const rows = [
    {
      part: 'glasses',
      label: 'Glasses',
      names: GLASSES_NAMES,
      count: AVATAR_GLASSES.length,
      row: GLASSES_ROW,
    },
    {
      part: 'mouth',
      label: 'Mouth',
      names: MOUTH_NAMES,
      count: AVATAR_MOUTHS.length,
      row: MOUTH_ROW,
    },
  ] as const;

  return (
    <Dialog
      labelledBy={titleId}
      onClose={onClose}
      className="flex w-731 flex-col items-center rounded-dialog bg-dialog px-64 pt-44 pb-60"
    >
      <h2 id={titleId} className="text-w56 font-semibold text-button">
        Customize
      </h2>

      <div role="radiogroup" aria-label="Face colour" className="mt-22 flex gap-33">
        {Array.from({ length: AVATAR_FACE_COUNT }, (_, face) => (
          <button
            key={face}
            type="button"
            role="radio"
            aria-checked={draft.face === face}
            aria-label={`Face colour ${face + 1}`}
            onClick={() => setDraft({ ...draft, face })}
            className={cn(
              'size-30 rounded-full border border-black transition',
              draft.face === face
                ? 'ring-3 ring-button ring-offset-2 ring-offset-dialog'
                : 'hover:brightness-95',
            )}
            style={{ background: faceColour(face) }}
          />
        ))}
      </div>

      <div
        className="relative mt-34"
        style={{ width: `calc(var(--u) * ${STAGE_W})`, height: `calc(var(--u) * ${STAGE_H})` }}
      >
        {rows.map(({ part, label, names, count, row }) => {
          const index = draft[part];
          const step = (by: 1 | -1) => setDraft({ ...draft, [part]: cycle(index, by, count) });
          const side = [cycle(index, -1, count), cycle(index, 1, count)];
          return (
            <div key={part} role="group" aria-label={label}>
              <div
                aria-hidden
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-pill bg-panel"
                style={{
                  left: `calc(var(--u) * ${STAGE_W / 2})`,
                  top: `calc(var(--u) * ${row.y})`,
                  width: `calc(var(--u) * ${row.width})`,
                  height: `calc(var(--u) * ${row.height})`,
                }}
              />
              {side.map((option, i) => {
                const style = {
                  left: `calc(var(--u) * ${SIDE_X[i]})`,
                  top: `calc(var(--u) * ${row.y})`,
                };
                return part === 'glasses' && AVATAR_GLASSES[option] === 'none' ? (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-w20 text-mid"
                    style={style}
                  >
                    none
                  </span>
                ) : (
                  <AvatarPart
                    key={i}
                    part={part}
                    index={option}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2',
                      part === 'glasses' ? 'h-35 w-130' : 'h-18 w-36',
                    )}
                    style={style}
                  />
                );
              })}
              {([-1, 1] as const).map((by, i) => (
                <button
                  key={by}
                  type="button"
                  aria-label={`${by < 0 ? 'Previous' : 'Next'} ${label.toLowerCase()}`}
                  onClick={() => step(by)}
                  className="absolute grid size-26 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-bar transition hover:brightness-95"
                  style={{
                    left: `calc(var(--u) * ${ARROW_X[i]})`,
                    top: `calc(var(--u) * ${row.y})`,
                  }}
                >
                  <ChevronRightIcon className={cn('h-14 w-8 text-black', by < 0 && 'rotate-180')} />
                </button>
              ))}
              <p className="sr-only" aria-live="polite">
                {label}: {names[index]}
              </p>
            </div>
          );
        })}
        <Avatar
          avatar={draft}
          size={AVATAR}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `calc(var(--u) * ${STAGE_W / 2})`,
            top: `calc(var(--u) * ${STAGE_H / 2})`,
          }}
        />
      </div>

      <div className="mt-30 flex gap-41">
        <button
          type="button"
          onClick={() => {
            void setAvatar(draft);
            onClose();
          }}
          className="h-90 w-268 rounded-full bg-button text-w56 text-white transition hover:brightness-125"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-90 w-268 rounded-full bg-button text-w56 text-white transition hover:brightness-125"
        >
          Exit
        </button>
      </div>
    </Dialog>
  );
}
