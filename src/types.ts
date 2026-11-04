export type SafetyStatus = 'alert' | 'clear';

export type AlarmState = 'idle' | 'armed' | 'ringing' | 'postponed';

/** Метадані власної мелодії (сам MP3 зберігається в IndexedDB, не в localStorage). */
export interface AlarmMelody {
  /** Ім'я завантаженого файлу. */
  fileName: string;
  /** Тривалість у секундах (не більше 30). */
  duration: number;
  /** Розмір файлу в байтах. */
  size: number;
}

export interface AlarmItem {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
  soundOn: boolean;
  daysOfWeek: string[];
  /** Власна мелодія замість стандартного сигналу. */
  melody?: AlarmMelody | null;
}

/** Стан тривоги, отриманий з API (ручного режиму більше немає). */
export interface AlertState {
  /** null — даних немає (немає ключа, області або сталася помилка). */
  status: SafetyStatus | null;
  level: 'red' | 'yellow' | null;
  /** Час останньої успішної/невдалої перевірки. */
  checkedAt: number | null;
  /** Локації, де зафіксовано тривогу (для підпису). */
  note: string | null;
}
