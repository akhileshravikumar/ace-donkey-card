import { useEffect, useState } from 'react';

/** Seconds remaining until `deadline` (epoch ms), updated every second. */
export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span>{seconds}s</span>;
}
