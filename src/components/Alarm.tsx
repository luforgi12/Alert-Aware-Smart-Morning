import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Bell, BellRing, Plus, Trash2, Volume2, VolumeX,
  Moon, Sunrise, Play, Square,
} from 'lucide-react';
import type { SafetyStatus, AlarmItem } from '../types';

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

/** Код дня тижня (Mon..Sun) для переданої дати. */
function dayCode(date: Date): string {
  return DAYS[(date.getDay() + 6) % 7].code;
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
  safetyStatus: SafetyStatus | null;
  alertLevel: 'red' | 'yellow' | null;
  postponeOnRed: boolean;
  postponeOnYellow: boolean;
  regionName: string;
}

export function Alarm({
  alarms, onAdd, onDelete, onToggle, onSetTime, onToggleSound, onToggleDay, onDismissed,
  safetyStatus, alertLevel, postponeOnRed, postponeOnYellow, regionName,
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
}

function AlarmRow({
  alarm, safetyStatus, alertLevel, postponeOnRed, postponeOnYellow, regionName,
  onToggle, onSetTime, onToggleSound, onToggleDay, onDelete, onDismissed,
}: RowProps) {
  const [triggered, setTriggered] = useState(false);
  const [postponed, setPostponed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedKeyRef = useRef<string>('');

  const days = alarm.daysOfWeek && alarm.daysOfWeek.length > 0 ? alarm.daysOfWeek : ALL_DAYS;
  const daysKey = days.join(',');

  // Кожен рівень тривоги має власне налаштування перенесення.
  const postponeForLevel = alertLevel === 'yellow' ? postponeOnYellow : postponeOnRed;
  const shouldPostpone = safetyStatus === 'alert' && postponeForLevel;

  const stopBeep = useCallback(() => {
    if (beepRef.current) {
      clearInterval(beepRef.current);
      beepRef.current = null;
    }
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

      // --- Спрацювання ---
      if (!allowed.includes(dayCode(now))) return;
      if (now.getHours() !== hours || now.getMinutes() !== minutes) return;

      const key = `${now.toDateString()} ${alarm.time}`;
      if (firedKeyRef.current === key) return;
      firedKeyRef.current = key;

      if (shouldPostpone) {
        setPostponed(true);
      } else {
        setTriggered(true);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alarm.enabled, alarm.time, shouldPostpone, daysKey, stopBeep]);

  // Коли перенесення більше не потрібне (відбій або вимкнене
  // налаштування) — дзвонимо.
  useEffect(() => {
    if (postponed && !shouldPostpone) {
      setTriggered(true);
      setPostponed(false);
    }
  }, [postponed, shouldPostpone]);

  // Цикл звуку.
  useEffect(() => {
    if (triggered) {
      playBeep();
      beepRef.current = setInterval(playBeep, 1500);
    } else {
      stopBeep();
    }
    return stopBeep;
  }, [triggered, playBeep, stopBeep]);

  // Прибирання.
  useEffect(() => {
    return () => {
      stopBeep();
      if (audioCtxRef.current) void audioCtxRef.current.close();
    };
  }, [stopBeep]);

  const dismiss = () => {
    setTriggered(false);
    stopBeep();
    onDismissed();
  };

  const isRinging = triggered;
  const isPostponed = postponed && !triggered;
  const sortedDays = useMemo(
    () => DAYS.filter((d) => days.includes(d.code)),
    [daysKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isRinging
          ? 'border-amber-500 bg-amber-500/10 animate-glow-alert'
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
          {timeLeft && (
            <p className="text-xs text-muted-soft truncate">
              {isRinging ? 'дзвонить зараз' : timeLeft}
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

      {/* Банер дзвінка */}
      {isRinging && (
        <div className="mt-3 flex items-center justify-between gap-3 animate-fade-in">
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
          <button
            onClick={dismiss}
            className="text-sm bg-amber-500 hover:bg-amber-400 text-ink font-semibold rounded-md px-3 py-1 transition-colors"
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
