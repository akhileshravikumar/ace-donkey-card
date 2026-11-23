import { type FormEvent, useEffect, useRef, useState } from 'react';
import { CHAT_MAX_LENGTH } from '@ace/shared';
import { useGame } from '../../state/context';
import { cn } from '../../ui/cn';
import { ChevronRightIcon } from '../../ui/icons';

/** "Chat Room" from the game wireframe: messages for everyone in the room (R24). */
export function ChatRoom({ className }: { className?: string }) {
  const chat = useGame((s) => s.chat);
  const you = useGame((s) => s.update?.room.you);
  const sendChat = useGame((s) => s.sendChat);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await sendChat(text)) setText('');
  };

  return (
    <section
      aria-labelledby="chat-heading"
      className={cn(
        'flex h-715 w-752 max-w-full flex-col rounded-bar bg-bar px-22 pt-28 pb-22',
        className,
      )}
    >
      <h2 id="chat-heading" className="px-18 pb-14 text-w40 font-semibold">
        Chat Room
      </h2>
      <div className="flex min-h-0 flex-1 flex-col rounded-panel bg-panel p-14">
        <ol
          ref={listRef}
          aria-live="polite"
          aria-label="Messages"
          className="min-h-0 flex-1 space-y-10 overflow-y-auto px-8 py-6 text-w24"
        >
          {chat.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[85%] w-fit rounded-[calc(var(--u)*18)] px-16 py-8',
                m.playerId === you ? 'ml-auto bg-mid text-white' : 'bg-white',
              )}
            >
              {m.playerId !== you && <b className="mr-8">{m.name}</b>}
              <span className="break-words">{m.text}</span>
            </li>
          ))}
        </ol>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-12 flex items-center gap-16">
          <input
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CHAT_MAX_LENGTH}
            autoComplete="off"
            className="h-58 min-w-0 flex-1 rounded-pill bg-white px-24 text-w24 outline-none focus-visible:ring-4 focus-visible:ring-button"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            className="grid h-58 w-101 place-items-center rounded-pill bg-button text-white disabled:opacity-60"
          >
            <ChevronRightIcon className="h-28 w-16" />
          </button>
        </form>
      </div>
    </section>
  );
}
