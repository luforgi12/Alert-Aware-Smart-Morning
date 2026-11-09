import { useEffect, useRef } from 'react';

/**
 * Тримає екран увімкненим, поки `active === true` і вкладка видима.
 * Це не дає браузеру «заморозити» таймери будильника вночі.
 * Якщо Wake Lock не підтримується або заборонений — тихо нічого не робить.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release().catch(() => undefined);
    };

    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!('wakeLock' in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Браузер може відмовити (енергозбереження, дозволи) — це не помилка.
      }
    };

    // Після повернення на вкладку wake lock треба запросити знову.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active]);
}
