import { useEffect, useRef } from 'react';
import { useGame } from '../state/context';
import { Panel } from './ui';

/** Recent game events, newest at the bottom, announced politely to screen readers. */
export function EventLog() {
  const log = useGame((s) => s.log);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <section aria-labelledby="log-heading">
      <Panel className="p-4">
        <h2 id="log-heading" className="mb-2 text-sm font-semibold">
          What happened
        </h2>
        <ol
          ref={listRef}
          aria-live="polite"
          className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem)] pt-2"
        >
          {log.length === 0 && <li className="text-muted">Nothing yet.</li>}
          {log.slice(-30).map((line, i, arr) => (
            <li
              key={`${log.length - arr.length + i}`}
              className={i === arr.length - 1 ? 'text-fg' : 'text-muted'}
            >
              {line}
            </li>
          ))}
        </ol>
      </Panel>
    </section>
  );
}
