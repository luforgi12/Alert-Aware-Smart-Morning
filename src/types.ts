export type SafetyStatus = 'alert' | 'clear';

export type AlarmState = 'idle' | 'armed' | 'ringing' | 'postponed';

export interface AlarmItem {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
  soundOn: boolean;
  daysOfWeek: string[];
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
