import { useEffect, useState } from 'react';

export function Clock({ large = false }: { large?: boolean }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dateStr = now.toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (large) {
    return (
    <div className="flex flex-col items-center gap-2">
        <div className="font-mono font-bold tabular-nums tracking-tight text-6xl sm:text-7xl md:text-8xl text-fg leading-none">
          <span>{hh}</span>
          <span className="text-muted-soft/60 animate-pulse-slow">:</span>
          <span>{mm}</span>
          <span className="text-muted-soft/60 text-4xl sm:text-5xl md:text-6xl">:{ss}</span>
        </div>
        <p className="text-sm sm:text-base text-muted-soft capitalize">{dateStr}</p>
      </div>
    );
  }

  return (
    <div className="font-mono font-semibold tabular-nums text-xl text-fg">
      {hh}:{mm}
    </div>
  );
}
