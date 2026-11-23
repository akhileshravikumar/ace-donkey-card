import { type FormEvent, useState } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@ace/shared';
import { useGame } from '../state/context';
import { Avatar } from '../ui/Avatar';
import { darkButton, lightButton } from '../ui/buttons';
import { CustomizeModal } from './CustomizeModal';
import { RulesModal } from './RulesModal';

const NAME_KEY = 'ace-donkey.name';

function initialCode(): string {
  try {
    return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
  } catch {
    return '';
  }
}

function initialName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

const input =
  'h-68 w-full rounded-pill bg-bar px-30 text-w40 outline-none placeholder:text-mid focus-visible:ring-4 focus-visible:ring-button';

/**
 * Entry screen (not in the wireframes; same building blocks): pick a name and avatar, then create
 * a room or join one — the code is filled in when opened from an invite link or the home page.
 */
export function Home() {
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const busy = useGame((s) => s.busy);
  const connected = useGame((s) => s.connection === 'connected');
  const avatar = useGame((s) => s.avatar);
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [dialog, setDialog] = useState<'avatar' | 'rules' | null>(null);
  const invited = initialCode().length > 0;

  const remember = () => {
    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* ignore */
    }
  };
  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    remember();
    void createRoom(name);
  };
  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    remember();
    void joinRoom(code, name);
  };
  const disabled = busy || !connected || name.trim().length === 0;

  return (
    <main className="mx-auto w-full max-w-1920 px-120 pb-60 max-md:px-24">
      <h1 className="mt-48 text-center text-w80 leading-tight font-semibold">Ace / Donkey</h1>

      <div className="mt-60 flex flex-wrap items-start justify-center gap-x-160 gap-y-60">
        <section aria-label="Your avatar" className="flex w-420 flex-col items-center">
          <div className="grid size-300 place-items-center">
            <Avatar avatar={avatar} size={220} />
          </div>
          <button
            type="button"
            className={`${lightButton} mt-24`}
            onClick={() => setDialog('avatar')}
          >
            Change Avatar
          </button>
          <button
            type="button"
            className={`${lightButton} mt-16`}
            onClick={() => setDialog('rules')}
          >
            Rules
          </button>
        </section>

        <section aria-label="Play" className="w-580">
          <label className="block">
            <span className="text-w40 font-semibold">Your Name</span>
            <input
              className={`${input} mt-16`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="nickname"
              placeholder="Name"
            />
          </label>

          <form onSubmit={onJoin} className="mt-48">
            <label className="block">
              <span className="text-w40 font-semibold">Room Code</span>
              <input
                className={`${input} mt-16 font-code tracking-[0.28em] uppercase`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="CODE"
              />
            </label>
            <button
              type="submit"
              className={`${invited ? darkButton : lightButton} mt-16`}
              disabled={disabled || code.trim().length !== ROOM_CODE_LENGTH}
            >
              Join Room
            </button>
          </form>

          <form onSubmit={onCreate} className="mt-48">
            <span className="text-w40 font-semibold">New Room</span>
            <button
              type="submit"
              className={`${invited ? lightButton : darkButton} mt-16`}
              disabled={disabled}
            >
              Create Room
            </button>
          </form>
        </section>
      </div>

      {dialog === 'avatar' && <CustomizeModal onClose={() => setDialog(null)} />}
      {dialog === 'rules' && <RulesModal onClose={() => setDialog(null)} />}
    </main>
  );
}
