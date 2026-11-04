import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Settings, MapPin, Moon, RefreshCw, ShieldAlert, ShieldCheck, Radar, Radio, TriangleAlert } from 'lucide-react';
import { Clock as ClockWidget } from './components/Clock';
import { SettingsModal } from './components/SettingsModal';
import { Alarm } from './components/Alarm';
import { hasAlertsKey, fetchAlertStatus } from './api';
import { deleteAlarmMelody } from './soundStore';
import { OBLASTS, districtsOf, oblastByUid } from './locations';
import type { AlertState, AlarmItem, AlarmMelody } from './types';
import type { Theme } from './components/SettingsModal';

const LS_ALARMS = 'alarms_list';
const LS_OBLAST = 'selected_oblast_uid';
const LS_DISTRICT = 'selected_district_uid';
const LS_THEME = 'app_theme';
const LS_POSTPONE_RED = 'postpone_on_red';
const LS_POSTPONE_YELLOW = 'postpone_on_yellow';

function loadTheme(): Theme {
  try {
    return localStorage.getItem(LS_THEME) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function loadAlarms(): AlarmItem[] {
  try {
    const raw = localStorage.getItem(LS_ALARMS);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Ensure backward compatibility - add default days if not present
        const result: AlarmItem[] = [];
        for (const alarm of parsed) {
          result.push({
            id: alarm.id || uid(),
            time: alarm.time || '07:30',
            enabled: alarm.enabled !== false,
            label: alarm.label || '',
            soundOn: alarm.soundOn !== false,
            daysOfWeek: alarm.daysOfWeek || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            melody: normalizeMelody(alarm.melody),
          });
        }
        return result;
      }
    }
  } catch { /* ignore */ }
  return [];
}

function saveAlarms(alarms: AlarmItem[]): void {
  localStorage.setItem(LS_ALARMS, JSON.stringify(alarms));
}

/** Перевіряє збережені метадані мелодії (старі записи можуть бути без них). */
function normalizeMelody(value: unknown): AlarmMelody | null {
  if (!value || typeof value !== 'object') return null;
  const melody = value as Partial<AlarmMelody>;
  if (typeof melody.fileName !== 'string' || !melody.fileName) return null;
  if (typeof melody.duration !== 'number' || !Number.isFinite(melody.duration)) return null;
  if (melody.duration <= 0 || melody.duration > 30) return null;
  return {
    fileName: melody.fileName,
    duration: melody.duration,
    size: typeof melody.size === 'number' ? melody.size : 0,
  };
}

function loadUid(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function loadPostponeOnRed(): boolean {
  try {
    return localStorage.getItem(LS_POSTPONE_RED) !== 'false';
  } catch {
    return true;
  }
}

function loadPostponeOnYellow(): boolean {
  try {
    // Жовта тривога за замовчуванням будильник не переносить.
    return localStorage.getItem(LS_POSTPONE_YELLOW) === 'true';
  } catch {
    return false;
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [postponeOnRed, setPostponeOnRed] = useState<boolean>(loadPostponeOnRed);
  const [postponeOnYellow, setPostponeOnYellow] = useState<boolean>(loadPostponeOnYellow);
  const [oblastUid, setOblastUid] = useState<number | null>(() => loadUid(LS_OBLAST));
  const [districtUid, setDistrictUid] = useState<number | null>(() => loadUid(LS_DISTRICT));
  const [alertState, setAlertState] = useState<AlertState>({
    status: null,
    level: null,
    checkedAt: null,
    note: null,
  });
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  // Ідентифікатор останнього запиту — щоб відповідь для старої локації
  // не перезаписувала статус нової (наприклад, при швидкій зміні району).
  const alertRequestRef = useRef(0);

  const [alarms, setAlarms] = useState<AlarmItem[]>(loadAlarms);

  const oblast = oblastByUid(oblastUid);

  const oblastsSorted = useMemo(
    () => [...OBLASTS].sort((a, b) => a.name.localeCompare(b.name, 'uk')),
    []
  );
  const districts = useMemo(
    () => (oblastUid === null ? [] : districtsOf(oblastUid)),
    [oblastUid]
  );
  // Захист від застарілого збереженого району з іншої області.
  const district = useMemo(
    () => districts.find((d) => d.uid === districtUid) ?? null,
    [districts, districtUid]
  );

  const regionName = district?.name ?? oblast?.name ?? '';
  // Чи налаштовано ключ на сервері (сам токен у браузер не потрапляє).
  const [alertsKeyConnected, setAlertsKeyConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasAlertsKey().then((connected) => {
      if (!cancelled) setAlertsKeyConnected(connected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply + persist theme
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  // Глобальні налаштування: чи переносити будильники під час тривоги.
  useEffect(() => {
    localStorage.setItem(LS_POSTPONE_RED, String(postponeOnRed));
  }, [postponeOnRed]);

  useEffect(() => {
    localStorage.setItem(LS_POSTPONE_YELLOW, String(postponeOnYellow));
  }, [postponeOnYellow]);

  // Прибираємо ключі, які раніше зберігалися вручну через налаштування.
  useEffect(() => {
    localStorage.removeItem('openrouter_api_key');
    localStorage.removeItem('alerts_api_key');
    localStorage.removeItem('selected_region');
  }, []);

  // Persist alarms to localStorage
  useEffect(() => {
    saveAlarms(alarms);
  }, [alarms]);

  // Persist selected location
  useEffect(() => {
    if (oblastUid === null) localStorage.removeItem(LS_OBLAST);
    else localStorage.setItem(LS_OBLAST, String(oblastUid));
  }, [oblastUid]);

  useEffect(() => {
    if (districtUid === null) localStorage.removeItem(LS_DISTRICT);
    else localStorage.setItem(LS_DISTRICT, String(districtUid));
  }, [districtUid]);

  // Скидаємо статус при зміні локації, щоб не показувати дані іншого регіону.
  useEffect(() => {
    alertRequestRef.current += 1;
    setCheckingAlerts(false);
    setAlertState({ status: null, level: null, checkedAt: null, note: null });
  }, [oblastUid, districtUid]);

  const refreshAlertStatus = useCallback(async () => {
    const selectedOblast = oblastByUid(oblastUid);
    if (!selectedOblast || alertsKeyConnected !== true) return;

    const selectedDistrict = district;
    const requestId = alertRequestRef.current + 1;
    alertRequestRef.current = requestId;
    setCheckingAlerts(true);
    const result = await fetchAlertStatus({
      oblastUid: selectedOblast.uid,
      oblastName: selectedOblast.name,
      districtUid: selectedDistrict?.uid ?? null,
      districtName: selectedDistrict?.name ?? null,
    });
    // Поки чекали відповідь, локацію змінили або запустили новий запит.
    if (requestId !== alertRequestRef.current) return;
    setAlertState(
      result
        ? { ...result, checkedAt: Date.now() }
        : { status: null, level: null, checkedAt: Date.now(), note: null }
    );
    setCheckingAlerts(false);
  }, [oblastUid, district, alertsKeyConnected]);

  // Автооновлення статусу кожні 30 секунд, коли є ключ і вибрана область.
  useEffect(() => {
    if (!alertsKeyConnected || oblastUid === null) return;
    void refreshAlertStatus();
    const timer = setInterval(() => {
      void refreshAlertStatus();
    }, 30000);
    return () => clearInterval(timer);
  }, [alertsKeyConnected, oblastUid, refreshAlertStatus]);

  const handleOblastChange = (value: string) => {
    setOblastUid(value ? Number(value) : null);
    setDistrictUid(null);
  };

  // Alarm list operations
  const addAlarm = (time: string, label: string, days: string[]) => {
    setAlarms((prev) => [
      ...prev,
      { id: uid(), time, enabled: true, label, soundOn: true, daysOfWeek: days, melody: null },
    ]);
  };

  const deleteAlarm = (id: string) => {
    void deleteAlarmMelody(id);
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const setAlarmMelody = (id: string, melody: AlarmMelody | null) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, melody } : a)));
  };

  const toggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const setAlarmTime = (id: string, time: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, time } : a))
    );
  };

  const toggleAlarmSound = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, soundOn: !a.soundOn } : a))
    );
  };

  const toggleAlarmDay = (id: string, day: string) => {
    setAlarms((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const current = a.daysOfWeek ?? [];
        // Останній день зняти не можна — інакше будильник ніколи не спрацює.
        if (current.includes(day) && current.length === 1) return a;
        const next = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        return { ...a, daysOfWeek: next };
      })
    );
  };

  // When an alarm is dismissed (ringing stopped), disable it
  const dismissAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: false } : a))
    );
  };

  const checkedAtText = alertState.checkedAt
    ? new Date(alertState.checkedAt).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const hasData = alertState.status !== null;
  const isAlert = alertState.status === 'alert';
  const isYellow = isAlert && alertState.level === 'yellow';
  const isRed = isAlert && !isYellow;
  const isClear = alertState.status === 'clear';

  const indicatorTone = isRed
    ? 'border-alert bg-alert/10'
    : isYellow
      ? 'border-amber-500 bg-amber-500/10'
      : isClear
        ? 'border-safe bg-safe/10'
        : 'border-ink-border bg-ink';

  const indicatorTitleTone = isRed
    ? 'text-alert'
    : isYellow
      ? 'text-accent'
      : isClear
        ? 'text-safe'
        : 'text-muted';

  let indicatorTitle = 'Немає даних';
  let indicatorHint = 'Додайте токен API у файл API';
  if (alertsKeyConnected === false) {
    indicatorTitle = 'Немає даних';
    indicatorHint = 'Ключ API не задано — статус тривоги недоступний';
  } else if (alertsKeyConnected === null) {
    indicatorTitle = 'Перевіряємо…';
    indicatorHint = 'З’ясовуємо стан сервера';
  } else if (oblastUid === null) {
    indicatorTitle = 'Оберіть область';
    indicatorHint = 'Оберіть область або район, щоб бачити статус тривоги';
  } else if (checkingAlerts && !hasData) {
    indicatorTitle = 'Перевіряємо…';
    indicatorHint = 'Отримуємо дані з alerts.in.ua';
  } else if (isAlert) {
    indicatorTitle = isYellow ? 'Жовта тривога' : 'Червона тривога';
    indicatorHint = isYellow
      ? postponeOnYellow
        ? 'Попередня загроза · будильник чекає відбою'
        : 'Попередня загроза · будильники дзвонять як звичайно'
      : postponeOnRed
        ? 'Висока загроза · будильник чекає відбою'
        : 'Висока загроза · перенесення вимкнено';
    if (alertState.note) indicatorHint += ` · ${alertState.note}`;
  } else if (isClear) {
    indicatorTitle = 'Тривоги немає';
    indicatorHint = regionName ? `У регіоні: ${regionName}` : 'У вибраному регіоні';
  } else {
    indicatorTitle = 'Немає даних';
    indicatorHint = 'Не вдалося отримати статус з API. Спробуйте оновити.';
  }

  return (
    <div className="min-h-screen bg-ink text-fg flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-ink-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center">
            <Moon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Alert-Aware</h1>
            <p className="text-xs text-muted-soft">Smart Morning</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ClockWidget />
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 text-sm text-muted hover:text-fg border border-ink-border hover:border-ink-border/80 rounded-lg px-3 py-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Налаштування</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-5 sm:px-8 py-8">
        <div className="w-full max-w-xl mx-auto flex flex-col items-center animate-fade-in">
          {/* Big clock */}
          <ClockWidget large />

          <p className="text-center text-muted mt-6 mb-8 max-w-md">
            Розумний будильник — спить, якщо тривога, будить при відбої
          </p>

          {/* Controls */}
          <div className="w-full bg-ink-card border border-ink-border rounded-2xl p-6 sm:p-8 space-y-6">
            {/* Вибір локації: область + район */}
            <div className="space-y-3">
              <label htmlFor="oblast-select" className="flex items-center gap-2 text-sm text-muted">
                <MapPin className="w-4 h-4" />
                Область
              </label>
              <select
                id="oblast-select"
                value={oblastUid ?? ''}
                onChange={(e) => handleOblastChange(e.target.value)}
                className="w-full bg-ink border border-ink-border rounded-lg px-4 py-3 text-fg focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
              >
                <option value="">— Оберіть область —</option>
                {oblastsSorted.map((o) => (
                  <option key={o.uid} value={o.uid}>
                    {o.name}
                  </option>
                ))}
              </select>

              <label htmlFor="district-select" className="flex items-center gap-2 text-sm text-muted">
                <MapPin className="w-4 h-4" />
                Район
              </label>
              <select
                id="district-select"
                value={district?.uid ?? ''}
                onChange={(e) => setDistrictUid(e.target.value ? Number(e.target.value) : null)}
                disabled={oblastUid === null || districts.length === 0}
                className="w-full bg-ink border border-ink-border rounded-lg px-4 py-3 text-fg focus:outline-none focus:border-amber-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Уся область</option>
                {districts.map((d) => (
                  <option key={d.uid} value={d.uid}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Індикатор тривоги (лише дані API) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Radio className="w-4 h-4" />
                  Статус тривоги
                </span>
                <div className="flex items-center gap-2">
                  {checkedAtText && (
                    <span className="text-xs text-muted-soft">оновлено {checkedAtText}</span>
                  )}
                  <button
                    onClick={() => void refreshAlertStatus()}
                    disabled={checkingAlerts || !alertsKeyConnected || oblastUid === null}
                    className="text-muted-soft hover:text-fg transition-colors disabled:opacity-40"
                    title="Оновити статус"
                    aria-label="Оновити статус тривоги"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingAlerts ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div
                role="status"
                aria-live="polite"
                className={`rounded-xl border-2 px-4 py-4 flex items-center gap-3 transition-colors ${indicatorTone}`}
              >
                {isRed ? (
                  <ShieldAlert className="w-6 h-6 text-alert flex-shrink-0" />
                ) : isYellow ? (
                  <TriangleAlert className="w-6 h-6 text-accent flex-shrink-0" />
                ) : isClear ? (
                  <ShieldCheck className="w-6 h-6 text-safe flex-shrink-0" />
                ) : (
                  <Radar
                    className={`w-6 h-6 flex-shrink-0 ${
                      checkingAlerts ? 'animate-spin text-muted' : 'text-muted-soft'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className={`text-base font-semibold leading-tight ${indicatorTitleTone}`}>
                    {indicatorTitle}
                  </p>
                  <p className="text-xs text-muted-soft mt-0.5 truncate">{indicatorHint}</p>
                </div>
              </div>
            </div>

            {/* Alarm list */}
            <Alarm
              alarms={alarms}
              onAdd={addAlarm}
              onDelete={deleteAlarm}
              onToggle={toggleAlarm}
              onSetTime={setAlarmTime}
              onToggleSound={toggleAlarmSound}
              onToggleDay={toggleAlarmDay}
              onDismissed={dismissAlarm}
              onMelodyChange={setAlarmMelody}
              safetyStatus={alertState.status}
              alertLevel={alertState.level}
              postponeOnRed={postponeOnRed}
              postponeOnYellow={postponeOnYellow}
              regionName={regionName}
            />

            {/* Джерело даних */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${alertsKeyConnected ? 'bg-safe' : 'bg-amber-500'}`} />
              <span className="text-muted-soft">
                {alertsKeyConnected
                  ? 'Дані alerts.in.ua · автооновлення кожні 30 секунд'
                  : 'Сервер API недоступний'}
              </span>
            </div>
          </div>
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        postponeOnRed={postponeOnRed}
        onPostponeOnRedChange={setPostponeOnRed}
        postponeOnYellow={postponeOnYellow}
        onPostponeOnYellowChange={setPostponeOnYellow}
      />
    </div>
  );
}
