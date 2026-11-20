import { type FormEvent, useState } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@ace/shared';
import { useGame } from '../state/context';
import { Button, Panel, cn, inputClass } from './ui';

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

/** Choose a display name, then create a room or join one by code (R20, R21). */
export function Home() {
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const busy = useGame((s) => s.busy);
  const connected = useGame((s) => s.connection === 'connected');
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
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
    <section aria-labelledby="home-heading" className="mx-auto mt-10 max-w-md">
      <Panel className="flex flex-col gap-6 p-8">
        <div>
          <h2 id="home-heading" className="text-2xl font-bold">
            {invited ? 'You’re invited' : 'Play'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            3–7 players · don’t be the last one holding cards.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="nickname"
            placeholder="e.g. Priya"
            required
          />
        </label>

        <form onSubmit={onJoin} className={cn('space-y-3', invited ? 'order-2' : 'order-4')}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Room code</span>
            <input
              className={`${inputClass} font-mono text-lg tracking-[0.3em] uppercase`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={ROOM_CODE_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC123"
            />
          </label>
          <Button
            type="submit"
            variant={invited ? 'primary' : 'secondary'}
            className="w-full"
            disabled={disabled || code.trim().length !== ROOM_CODE_LENGTH}
          >
            Join room
          </Button>
        </form>

        <div className="order-3 flex items-center gap-3 text-xs text-muted uppercase">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onCreate} className={invited ? 'order-4' : 'order-2'}>
          <Button
            type="submit"
            variant={invited ? 'secondary' : 'primary'}
            className="w-full"
            disabled={disabled}
          >
            Create a room
          </Button>
        </form>
      </Panel>
    </section>
  );
}
