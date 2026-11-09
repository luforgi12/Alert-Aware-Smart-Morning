import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Bell, BellRing, Plus, Trash2, Volume2, VolumeX,
  Moon, Sunrise, Play, Square, AlarmClock,
  Music2, Upload, Loader2, Pause, X,
} from 'lucide-react';
import type { SafetyStatus, AlarmItem, AlarmMelody } from '../types';
import {
  MAX_MELODY_SECONDS, deleteAlarmMelody, formatDuration, getAlarmMelody, prepareAlarmMelody, saveAlarmMelody,
} from '../soundStore';
import { getAlarmRuntime, saveAlarmRuntime } from '../alarmRuntime';

/** Порядок з понеділка. `code` зберігається у localStorage. */
const DAYS = [
  { code: 'Mon', short: 'Пн', full: 'Понеділок' },
  { code: 'Tue', short: 'Вт', full: 'Вівторок' },
  { code: 'Wed', short: 'Ср', full: 'Середа' },
  { code: 'Thu', short: 'Чт', full: 'Четвер' },
  { code: 'Fri', short: 'Пт', full: 'П\u2019ятниця' },
  { code: 'Sat', short: 'Сб', full: 'Субота' },
  { code: 'Sun', short: 'Нд', full: 'Неділя' },
];

const ALL_DAYS = DAYS.map((d) => d.code);

/** Варіанти відкладання дзвінка (у хвилинах). */
const SNOOZE_OPTIONS = [5, 10];

/**
 * Скільки часу після запланованого моменту будильник ще може задзвонити,
 * якщо вкладка була призупинена браузером (сон ноутбука/телефона).
 * 2 години — щоб ранковий будильник не «загубився», якщо пристрій
 * прокинувся пізніше.
 */
const CATCH_UP_MS = 2 * 60 * 60 * 1000;

/** Повторний дзвінок після відкладання — час у мілісекундах. */
function snoozeTimestamp(minutes: number): number {
  return Date.now() + minutes * 60_000;
}

/** Код дня тижня (Mon..Sun) для переданої дати. */
function dayCode(date: Date): string {
  return DAYS[(date.getDay() + 6) % 7].code;
}

/**
 * Останній дозволений момент спрацювання, що вже минув (або `null`).
 * Використовується для «наздоганяючого» спрацювання після сну вкладки.
 */
function lastOccurrence(
  now: Date,
  hours: number,
  minutes: number,
  allowed: string[]
): Date | null {
  for (let i = 0; i < 8; i += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() - i);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() > now.getTime()) continue;
    if (!allowed.includes(dayCode(candidate))) continue;
    return candidate;
  }
  return null;
}

/** Ключ спрацювання: дата + час (не змінюється між перезавантаженнями). */
function fireKey(occurrence: Date, time: string): string {
  return `${occurrence.toDateString()} ${time}`;
}

interface Props {
  alarms: AlarmItem[];
  onAdd: (time: string, label: string, days: string[]) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onSetTime: (id: string, time: string) => void;
  onToggleSound: (id: string) => void;
  onToggleDay: (id: string, day: string) => void;
  onDismissed: (id: string) => void;
  onMelodyChange: (id: string, melody: AlarmMelody | null) => void;
  safetyStatus: SafetyStatus | null;
  alertLevel: 'red' | 'yellow' | null;
  postponeOnRed: boolean;
  postponeOnYellow: boolean;
  regionName: string;
}

export function Alarm({
  alarms, onAdd, onDelete, onToggle, onSetTime, onToggleSound, onToggleDay, onDismissed,
  onMelodyChange, safetyStatus, alertLevel, postponeOnRed, postponeOnYellow, regionName,
}: Props) {
  const [newTime, setNewTime] = useState('07:30');
  const [newLabel, setNewLabel] = useState('');
  const [newDays, setNewDays] = useState<string[]>(ALL_DAYS);

  const activeCount = alarms.filter((a) => a.enabled).length;

  const toggleNewDay = (day: string) => {
    setNewDays((prev) => {
      if (prev.includes(day)) {
        // Не дозволяємо зняти останній день — інакше будильник не спрацює.
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return DAYS.map((d) => d.code).filter((c) => c === day || prev.includes(c));
    });
  };

  return (
    <div className="rounded-xl border border-ink-border bg-ink p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-fg-soft">Будильники</span>
          {activeCount > 0 && (
            <span className="text-xs bg-amber-500/20 text-accent rounded-full px-2 py-0.5">
              {activeCount} активн{activeCount === 1 ? 'ий' : 'их'}
            </span>
          )}
        </div>
      </div>

      {/* Додавання нового будильника */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            aria-label="Час нового будильника"
            className="bg-ink-soft border border-ink-border rounded-lg px-3 py-2 text-fg font-mono text-sm focus:outline-none focus:border-amber-400 transition-colors"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={'Назва (необов\u2019язково)'}            aria-label="Назва нового будильника"
            className="flex-1 min-w-0 bg-ink-soft border border-ink-border rounded-lg px-3 py-2 text-fg text-sm placeholder:text-muted-soft focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button
            onClick={() => {
              onAdd(newTime, newLabel.trim(), newDays);
              setNewLabel('');
            }}
            className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Додати
          </button>
        </div>

        <DayPicker
          selected={newDays}
          onToggle={toggleNewDay}
          legend="Дні для нового будильника"
        />
      </div>

      {/* Список будильників */}
      <div className="space-y-3">
        {alarms.length === 0 && (
          <p className="text-sm text-muted-soft text-center py-4">
            Поки що немає будильників. Додайте перший вище.
          </p>
        )}
        {alarms.map((a) => (
          <AlarmRow
            key={a.id}
            alarm={a}
            safetyStatus={safetyStatus}
            alertLevel={alertLevel}
            postponeOnRed={postponeOnRed}
            postponeOnYellow={postponeOnYellow}
            regionName={regionName}
            onToggle={() => onToggle(a.id)}
            onSetTime={(t) => onSetTime(a.id, t)}
            onToggleSound={() => onToggleSound(a.id)}
            onToggleDay={(day) => onToggleDay(a.id, day)}
            onDelete={() => onDelete(a.id)}
            onDismissed={() => onDismissed(a.id)}
            onMelodyChange={(melody) => onMelodyChange(a.id, melody)}
          />
        ))}
      </div>
    </div>
  );
}

interface DayPickerProps {
  selected: string[];
  onToggle: (day: string) => void;
  legend: string;
  disabled?: boolean;
}

/** 7 днів у сітці 4 + 3 — рівно два рядки. */
function DayPicker({ selected, onToggle, legend, disabled }: DayPickerProps) {
  return (
    <div role="group" aria-label={legend} className="grid grid-cols-4 gap-1">
      {DAYS.map((day) => {
        const active = selected.includes(day.code);
        return (
          <button
            key={day.code}
            type="button"
            onClick={() => onToggle(day.code)}
            disabled={disabled}
            aria-pressed={active}
            title={day.full}
            className={`rounded-md py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
              active
                ? 'bg-amber-500/20 text-accent border border-amber-500/40'
                : 'bg-ink border border-ink-border text-muted-soft hover:text-fg-soft'
            }`}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

interface RowProps {
  alarm: AlarmItem;
  safetyStatus: SafetyStatus | null;
  alertLevel: 'red' | 'yellow' | null;
  postponeOnRed: boolean;
  postponeOnYellow: boolean;
  regionName: string;
  onToggle: () => void;
  onSetTime: (t: string) => void;
  onToggleSound: () => void;
  onToggleDay: (day: string) => void;
  onDelete: () => void;
  onDismissed: () => void;
  onMelodyChange: (melody: AlarmMelody | null) => void;
}

function AlarmRow({
  alarm, safetyStatus, alertLevel, postponeOnRed, postponeOnYellow, regionName,
  onToggle, onSetTime, onToggleSound, onToggleDay, onDelete, onDismissed, onMelodyChange,
}: RowProps) {
  // Стан, збережений у localStorage: переживає перезавантаження вкладки.
  const initialRuntime = useMemo(() => getAlarmRuntime(alarm.id), [alarm.id]);

  const [triggered, setTriggered] = useState(false);
  const [postponed, setPostponed] = useState<boolean>(initialRuntime?.postponed ?? false);
  // Час, коли відкладений будильник має задзвонити знову (null — не відкладено).
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(
    initialRuntime?.snoozedUntil ?? null
  );
  const [timeLeft, setTimeLeft] = useState('');
  const [melodyBusy, setMelodyBusy] = useState(false);
  const [melodyError, setMelodyError] = useState<string | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringUrlRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewTokenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const firedKeyRef = useRef<string>(initialRuntime?.firedKey ?? '');
  // Час останнього «озброєння» будильника (вмикання / зміна часу чи днів).
  const armedAtRef = useRef<number>(initialRuntime?.armedAt ?? Date.now());

  /** Зберігає поточний стан будильника у localStorage. */
  const writeRuntime = useCallback(
    (next: {
      postponed: boolean;
      snoozedUntil: number | null;
      firedKey?: string;
      armedAt?: number;
    }) => {
      saveAlarmRuntime(alarm.id, {
        armedAt: next.armedAt ?? armedAtRef.current,
        firedKey: next.firedKey !== undefined ? next.firedKey : firedKeyRef.current,
        postponed: next.postponed,
        snoozedUntil: next.snoozedUntil,
      });
    },
    [alarm.id]
  );


  const days = alarm.daysOfWeek && alarm.daysOfWeek.length > 0 ? alarm.daysOfWeek : ALL_DAYS;
  const daysKey = days.join(',');

  // Кожен рівень тривоги має власне налаштування перенесення.
  const postponeForLevel = alertLevel === 'yellow' ? postponeOnYellow : postponeOnRed;
  const shouldPostpone = safetyStatus === 'alert' && postponeForLevel;

  // Зберігаємо зміни стану, щоб вони пережили перезавантаження вкладки.
  useEffect(() => {
    writeRuntime({ postponed, snoozedUntil });
  }, [writeRuntime, postponed, snoozedUntil]);

  // Після вмикання або зміни часу/днів не «наздоганяємо» час, який уже минув
  // (інакше щойно створений будильник міг би задзвонити одразу).
  const prevEnabledRef = useRef(alarm.enabled);
  const prevTimeRef = useRef(alarm.time);
  const prevDaysKeyRef = useRef(daysKey);

  useEffect(() => {
    const becameEnabled = alarm.enabled && !prevEnabledRef.current;
    const timeChanged = prevTimeRef.current !== alarm.time;
    const daysChanged = prevDaysKeyRef.current !== daysKey;

    prevEnabledRef.current = alarm.enabled;
    prevTimeRef.current = alarm.time;
    prevDaysKeyRef.current = daysKey;

    if (!alarm.enabled) return;
    if (!becameEnabled && !timeChanged && !daysChanged) return;

    armedAtRef.current = Date.now();
    firedKeyRef.current = '';
    setTriggered(false);
    setPostponed(false);
    setSnoozedUntil(null);
    writeRuntime({ postponed: false, snoozedUntil: null, firedKey: '', armedAt: armedAtRef.current });
  }, [alarm.enabled, alarm.time, daysKey, writeRuntime]);

  const stopBeep = useCallback(() => {
    if (beepRef.current) {
      clearInterval(beepRef.current);
      beepRef.current = null;
    }
  }, []);

  /** Зупиняє відтворення MP3-мелодії під час дзвінка. */
  const stopRingAudio = useCallback(() => {
    if (ringAudioRef.current) {
      ringAudioRef.current.pause();
      ringAudioRef.current.removeAttribute('src');
      ringAudioRef.current.load();
      ringAudioRef.current = null;
    }
    if (ringUrlRef.current) {
      URL.revokeObjectURL(ringUrlRef.current);
      ringUrlRef.current = null;
    }
  }, []);

  /** Зупиняє прослуховування мелодії у списку будильників. */
  const stopPreview = useCallback(() => {
    // Інвалідовуємо ще не завершене завантаження мелодії зі сховища.
    previewTokenRef.current += 1;
    const audio = previewRef.current;
    if (audio) {
      // Без явного pause() відтворення триває навіть після revokeObjectURL.
      audio.pause();
      audio.onended = null;
      audio.removeAttribute('src');
      audio.load();
      previewRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewOn(false);
  }, []);

  const playBeep = useCallback(() => {
    if (!alarm.soundOn) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.32);
  }, [alarm.soundOn]);

  // Основний тік: зворотний відлік + спрацювання будильника.
  useEffect(() => {
    if (!alarm.enabled) {
      setTriggered(false);
      setPostponed(false);
      setSnoozedUntil(null);
      setTimeLeft('');
      stopBeep();
      return;
    }

    const allowed = daysKey.split(',');

    const tick = () => {
      const now = new Date();
      const [hours, minutes] = alarm.time.split(':').map(Number);

      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        setTimeLeft('');
        return;
      }

      // --- Час відкладеного дзвінка вийшов — дзвонимо знову ---
      if (snoozedUntil !== null && now.getTime() >= snoozedUntil) {
        setSnoozedUntil(null);
        // Якщо вкладка була закрита надовго, старе відкладання не дзвонимо.
        if (now.getTime() - snoozedUntil > CATCH_UP_MS) {
          writeRuntime({ postponed: false, snoozedUntil: null });
          return;
        }
        // Якщо саме зараз тривога і перенесення ввімкнене — знову чекаємо відбою.
        if (shouldPostpone) {
          setPostponed(true);
          writeRuntime({ postponed: true, snoozedUntil: null });
        } else {
          setTriggered(true);
          writeRuntime({ postponed: false, snoozedUntil: null });
        }
        return;
      }

      // --- Зворотний відлік до найближчого дозволеного дня ---
      let next: Date | null = null;
      for (let i = 0; i < 8; i += 1) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + i);
        candidate.setHours(hours, minutes, 0, 0);
        if (candidate.getTime() <= now.getTime()) continue;
        if (!allowed.includes(dayCode(candidate))) continue;
        next = candidate;
        break;
      }

      if (!next) {
        setTimeLeft('дні не вибрано');
      } else {
        const diff = next.getTime() - now.getTime();
        const diffHours = Math.floor(diff / 3600000);
        const diffMinutes = Math.floor((diff % 3600000) / 60000);
        if (diffHours > 0) {
          setTimeLeft(`через ${diffHours} год ${diffMinutes} хв`);
        } else if (diffMinutes > 0) {
          setTimeLeft(`через ${diffMinutes} хв`);
        } else {
          setTimeLeft('менше хвилини');
        }
      }

      // --- Спрацювання з «наздоганяючим» вікном ---
      // Якщо вкладку призупинили (сон пристрою), таймер міг «проспати»
      // точну хвилину. Тоді спрацьовуємо, щойно браузер прокинеться.
      const occurrence = lastOccurrence(now, hours, minutes, allowed);
      if (!occurrence) return;
      if (now.getTime() - occurrence.getTime() > CATCH_UP_MS) return;
      // Не дзвонимо за час, який минув ще до вмикання будильника.
      if (armedAtRef.current > occurrence.getTime()) return;

      const key = fireKey(occurrence, alarm.time);
      if (firedKeyRef.current === key) return;
      firedKeyRef.current = key;
      writeRuntime({
        postponed: shouldPostpone,
        snoozedUntil: null,
        firedKey: key,
      });

      if (shouldPostpone) {
        setPostponed(true);
      } else {
        setTriggered(true);
      }
    };

    tick();
    const id = setInterval(tick, 1000);

    // Прокидання вкладки: одразу перевіряємо пропущені спрацювання.
    const wake = () => tick();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('online', wake);
    };
  }, [alarm.enabled, alarm.time, shouldPostpone, daysKey, stopBeep, snoozedUntil, writeRuntime]);

  // Коли перенесення більше не потрібне (відбій або вимкнене
  // налаштування) — дзвонимо. Чекаємо на статус тривоги, щоб після
  // перезавантаження не дзвонити ще до отримання даних.
  useEffect(() => {
    if (!postponed) return;
    if (safetyStatus === null) return;
    if (shouldPostpone) return;

    setTriggered(true);
    setPostponed(false);
    writeRuntime({ postponed: false, snoozedUntil: null });
  }, [postponed, shouldPostpone, safetyStatus, writeRuntime]);

  // Цикл звуку: власна MP3-мелодія, а якщо її немає — стандартний сигнал.
  useEffect(() => {
    if (!triggered || !alarm.soundOn) {
      stopBeep();
      stopRingAudio();
      return;
    }

    stopPreview();

    if (!alarm.melody) {
      playBeep();
      beepRef.current = setInterval(playBeep, 1500);
      return () => {
        stopBeep();
      };
    }

    let cancelled = false;

    void (async () => {
      const blob = await getAlarmMelody(alarm.id);
      if (cancelled) return;

      if (!blob) {
        // Файл не знайшовся (наприклад, очищено сховище) — не мовчимо.
        playBeep();
        beepRef.current = setInterval(playBeep, 1500);
        return;
      }

      const url = URL.createObjectURL(blob);
      ringUrlRef.current = url;
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.8;
      ringAudioRef.current = audio;

      try {
        await audio.play();
      } catch {
        // Автовідтворення заблоковане браузером — дублюємо стандартним сигналом.
        if (!cancelled) {
          stopRingAudio();
          playBeep();
          beepRef.current = setInterval(playBeep, 1500);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopBeep();
      stopRingAudio();
    };
  }, [
    triggered, alarm.soundOn, alarm.melody, alarm.id,
    playBeep, stopBeep, stopRingAudio, stopPreview,
  ]);

  // Коли вкладка не на екрані — показуємо системне сповіщення та міняємо
  // заголовок, щоб будильник не загубився серед інших вікон.
  useEffect(() => {
    if (!triggered) return;

    const previousTitle = document.title;
    document.title = '🔔 Підйом! — Alert-Aware';

    // Вібрація працює лише після взаємодії зі сторінкою — інакше браузер
    // блокує виклик і пише помилку в консоль.
    const canVibrate =
      typeof navigator.vibrate === 'function' &&
      (navigator.userActivation?.hasBeenActive ?? true);
    if (canVibrate) {
      navigator.vibrate([400, 200, 400]);
    }

    let notification: Notification | null = null;
    if (
      document.visibilityState === 'hidden' &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        notification = new Notification('Підйом! Час вставати', {
          body: alarm.label ? `${alarm.label} · ${alarm.time}` : `Будильник на ${alarm.time}`,
          tag: `alarm-${alarm.id}`,
          requireInteraction: true,
          silent: !alarm.soundOn,
        });
        notification.onclick = () => {
          window.focus();
          notification?.close();
        };
      } catch {
        // На мобільних Chrome конструктор Notification недоступний.
        notification = null;
      }
    }

    return () => {
      document.title = previousTitle;
      if (canVibrate) navigator.vibrate(0);
      notification?.close();
    };
  }, [triggered, alarm.id, alarm.label, alarm.time, alarm.soundOn]);

  // Прибирання.
  useEffect(() => {
    return () => {
      stopBeep();
      stopRingAudio();
      stopPreview();
      if (audioCtxRef.current) void audioCtxRef.current.close();
    };
  }, [stopBeep, stopRingAudio, stopPreview]);

  const dismiss = () => {
    setTriggered(false);
    setSnoozedUntil(null);
    stopBeep();
    stopRingAudio();
    stopPreview();
    writeRuntime({ postponed: false, snoozedUntil: null });
    onDismissed();
  };

  /** Відкласти дзвінок: вимикає звук і планує повторне спрацювання. */
  const snooze = (minutes: number) => {
    setTriggered(false);
    setPostponed(false);
    stopBeep();
    stopRingAudio();
    stopPreview();
    const until = snoozeTimestamp(minutes);
    setSnoozedUntil(until);
    writeRuntime({ postponed: false, snoozedUntil: until });
  };

  /** Завантаження власної мелодії: перевірка формату/тривалості + збереження. */
  const handleMelodyFile = async (file: File | undefined) => {
    if (!file) return;
    setMelodyError(null);
    setMelodyBusy(true);
    stopPreview();
    try {
      const { blob, melody } = await prepareAlarmMelody(file);
      await saveAlarmMelody(alarm.id, blob);
      onMelodyChange(melody);
    } catch (error) {
      setMelodyError(error instanceof Error ? error.message : 'Не вдалося додати мелодію.');
    } finally {
      setMelodyBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMelody = async () => {
    stopPreview();
    await deleteAlarmMelody(alarm.id);
    onMelodyChange(null);
    setMelodyError(null);
  };

  /** Прослуховування мелодії без дзвінка. */
  const togglePreview = async () => {
    if (previewOn) {
      stopPreview();
      return;
    }
    const token = previewTokenRef.current + 1;
    previewTokenRef.current = token;
    const blob = await getAlarmMelody(alarm.id);
    // Поки читали файл, користувач міг натиснути «стоп» або інший будильник.
    if (token !== previewTokenRef.current) return;
    if (!blob) {
      setMelodyError('Файл мелодії не знайдено. Додайте його ще раз.');
      return;
    }
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    const audio = new Audio(url);
    audio.volume = 0.8;
    audio.onended = stopPreview;
    previewRef.current = audio;
    setPreviewOn(true);
    try {
      await audio.play();
    } catch {
      stopPreview();
      setMelodyError('Браузер заблокував відтворення. Спробуйте ще раз.');
    }
  };

  const isRinging = triggered;
  const isPostponed = postponed && !triggered;
  const isSnoozed = snoozedUntil !== null && !triggered;
  const snoozeLabel = snoozedUntil
    ? new Date(snoozedUntil).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const sortedDays = useMemo(
    () => DAYS.filter((d) => days.includes(d.code)),
    [daysKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isRinging
          ? 'border-amber-500 bg-amber-500/10 animate-glow-alert'
          : isSnoozed
            ? 'border-amber-500/50 bg-amber-500/5'
            : isPostponed
              ? 'border-alert/50 bg-alert/5'
              : alarm.enabled
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-ink-border bg-ink-soft'
      }`}
    >
      <div className="flex items-center gap-3">
        {isRinging ? (
          <BellRing className="w-5 h-5 text-accent animate-pulse flex-shrink-0" />
        ) : isSnoozed ? (
          <AlarmClock className="w-5 h-5 text-accent flex-shrink-0" />
        ) : isPostponed ? (
          <Moon className="w-5 h-5 text-alert flex-shrink-0" />
        ) : (
          <Bell className={`w-5 h-5 flex-shrink-0 ${alarm.enabled ? 'text-accent' : 'text-muted-soft'}`} />
        )}

        <input
          type="time"
          value={alarm.time}
          onChange={(e) => onSetTime(e.target.value)}
          disabled={!alarm.enabled}
          aria-label="Час будильника"
          className="bg-ink border border-ink-border rounded-md px-2.5 py-1.5 text-fg font-mono text-base focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-40"
        />

        <div className="flex-1 min-w-0">
          {alarm.label && (
            <p className="text-sm text-muted truncate">{alarm.label}</p>
          )}
          {(timeLeft || isSnoozed) && (
            <p className="text-xs text-muted-soft truncate">
              {isRinging
                ? 'дзвонить зараз'
                : isSnoozed
                  ? `відкладено до ${snoozeLabel}`
                  : timeLeft}
            </p>
          )}
        </div>

        <button
          onClick={onToggleSound}
          disabled={!alarm.enabled}
          aria-label={alarm.soundOn ? 'Вимкнути звук' : 'Увімкнути звук'}
          className="flex items-center justify-center w-8 h-8 rounded-md bg-ink border border-ink-border text-muted hover:text-fg transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {alarm.soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onToggle}
          aria-label={alarm.enabled ? 'Вимкнути будильник' : 'Увімкнути будильник'}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 ${
            alarm.enabled
              ? 'bg-amber-500/20 text-accent hover:bg-amber-500/30'
              : 'bg-ink border border-ink-border text-muted-soft hover:text-fg-soft'
          }`}
        >
          {alarm.enabled ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>

        <button
          onClick={onDelete}
          aria-label="Видалити будильник"
          className="flex items-center justify-center w-8 h-8 rounded-md bg-ink border border-ink-border text-muted-soft hover:text-alert hover:border-alert transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Дні тижня — два рядки (4 + 3) */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-soft">
          <span>Дні тижня</span>
          <span>{sortedDays.length === 7 ? 'щодня' : `${sortedDays.length} з 7`}</span>
        </div>
        <DayPicker
          selected={days}
          onToggle={onToggleDay}
          legend={`Дні будильника ${alarm.time}`}
        />
      </div>

      {/* Власна мелодія (MP3, до 30 секунд) */}
      <div className="mt-3 rounded-lg border border-ink-border bg-ink px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <Music2 className={`w-3.5 h-3.5 flex-shrink-0 ${alarm.melody ? 'text-accent' : 'text-muted-soft'}`} />

          <div className="flex-1 min-w-0">
            <p className="text-xs text-fg-soft truncate">
              {alarm.melody ? alarm.melody.fileName : 'Стандартний сигнал'}
            </p>
            <p className="text-[11px] text-muted-soft truncate">
              {alarm.melody
                ? `${formatDuration(alarm.melody.duration)} · MP3`
                : `Можна додати свій MP3 до ${MAX_MELODY_SECONDS} с`}
            </p>
          </div>

          {alarm.melody && (
            <button
              type="button"
              onClick={() => void togglePreview()}
              aria-label={previewOn ? 'Зупинити прослуховування' : 'Прослухати мелодію'}
              title={previewOn ? 'Зупинити' : 'Прослухати'}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-ink-soft border border-ink-border text-muted hover:text-fg transition-colors flex-shrink-0"
            >
              {previewOn ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          )}

          <label
            className={`flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-xs text-muted hover:text-fg cursor-pointer transition-colors flex-shrink-0 ${
              melodyBusy ? 'opacity-60 pointer-events-none' : ''
            }`}
            title="Обрати MP3-файл (до 30 секунд)"
          >
            {melodyBusy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            {alarm.melody ? 'Замінити' : 'Обрати MP3'}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              className="sr-only"
              onChange={(e) => void handleMelodyFile(e.target.files?.[0])}
            />
          </label>

          {alarm.melody && (
            <button
              type="button"
              onClick={() => void removeMelody()}
              aria-label="Видалити власну мелодію"
              title="Видалити мелодію"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-ink-border bg-ink-soft text-muted-soft hover:text-alert hover:border-alert transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {melodyError && (
          <p className="mt-1.5 text-[11px] leading-snug text-alert">{melodyError}</p>
        )}
      </div>

      {/* Банер дзвінка */}
      {isRinging && (
        <div className="mt-3 space-y-2.5 animate-fade-in" role="alert">
          <div className="flex items-start gap-2">
            <Sunrise className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm text-accent font-medium animate-pulse">
                Підйом! Час вставати
              </span>
              {safetyStatus === 'alert' && (
                <p className="text-xs text-muted-soft mt-0.5">
                  {alertLevel === 'yellow'
                    ? postponeOnYellow
                      ? 'Жовта тривога — будильник дзвонить'
                      : 'Жовта тривога — будильник дзвонить як звичайно'
                    : postponeOnRed
                      ? 'Червона тривога — будильник дзвонить'
                      : 'Червона тривога — перенесення вимкнено в налаштуваннях'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SNOOZE_OPTIONS.map((minutes, index) => (
              <button
                key={minutes}
                onClick={() => snooze(minutes)}
                className={
                  index === 0
                    ? 'flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-ink font-semibold rounded-md px-3 py-1.5 transition-colors'
                    : 'text-sm border border-amber-500/40 text-accent hover:bg-amber-500/10 font-medium rounded-md px-3 py-1.5 transition-colors'
                }
              >
                {index === 0 && <AlarmClock className="w-3.5 h-3.5" />}
                Відкласти {minutes} хв
              </button>
            ))}
            <button
              onClick={dismiss}
              className="ml-auto text-sm border border-ink-border text-muted hover:text-fg rounded-md px-3 py-1.5 transition-colors"
            >
              Вимкнути
            </button>
          </div>
        </div>
      )}

      {/* Банер відкладеного дзвінка */}
      {isSnoozed && (
        <div className="mt-3 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlarmClock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-accent font-medium">
                Відкладено до {snoozeLabel}
              </p>
              <p className="text-xs text-muted-soft mt-0.5">
                Дзвінок повториться автоматично, якщо вкладка відкрита.
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-sm border border-ink-border text-muted hover:text-fg rounded-md px-3 py-1 transition-colors flex-shrink-0"
          >
            Вимкнути
          </button>
        </div>
      )}

      {/* Банер перенесення */}
      {isPostponed && (
        <div className="mt-3 flex items-start gap-2 animate-fade-in">
          <Moon className="w-4 h-4 text-alert flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-alert font-medium">
              {alertLevel === 'yellow' ? 'Жовта тривога' : 'Червона тривога'} — будильник
              перенесено до відбою{regionName ? ` (${regionName})` : ''}
            </p>
            <p className="text-xs text-muted-soft mt-0.5">
              Будильник задзвонить, щойно тривогу скасують або перенесення вимкнуть у налаштуваннях.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
