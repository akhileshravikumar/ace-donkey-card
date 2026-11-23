import { useState } from 'react';
import { CopyIcon } from './icons';
import { cn } from './cn';

/** "A Z S 5 X 2 ⧉" — the code, spaced out, with a button that copies the invite link. */
export function RoomCode({
  code,
  className,
  iconClassName,
}: {
  code: string;
  className?: string;
  iconClassName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={cn('inline-flex items-center gap-[0.35em] font-code', className)}>
      <span aria-label={`Room code ${code.split('').join(' ')}`} className="tracking-[0.28em]">
        {code}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? 'Invite link copied' : 'Copy invite link'}
        title={copied ? 'Copied!' : 'Copy invite link'}
        className="relative"
      >
        <CopyIcon className={iconClassName} />
        {copied && (
          <span
            role="status"
            className="absolute top-full left-1/2 mt-4 -translate-x-1/2 rounded-pill bg-button px-10 py-2 font-sans text-w14 whitespace-nowrap text-white"
          >
            Link copied
          </span>
        )}
      </button>
    </span>
  );
}
