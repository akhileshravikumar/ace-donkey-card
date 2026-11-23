import { useEffect, useState } from 'react';

/** Seconds left until `deadline` (epoch ms), updated every second. */
export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.ceil((deadline - now) / 1000))}s</>;
}
