/**
 * Стан будильника, який має переживати перезавантаження вкладки
 * та призупинення таймерів браузером.
 */
export interface AlarmRuntime {
  /**
   * Коли будильник востаннє вмикали або змінювали (час, дні).
   * Потрібно, щоб не дзвонити за часом, який минув ще до вмикання.
   */
  armedAt: number;
  /** Ключ останнього спрацювання (`дата + час`), щоб не дзвонити двічі. */
  firedKey: string;
  /** Будильник перенесено через тривогу й чекає на відбій. */
  postponed: boolean;
  /** Час повторного дзвінка після «відкласти». */
  snoozedUntil: number | null;
}

const LS_RUNTIME = 'alarm_runtime_v1';

type RuntimeMap = Record<string, AlarmRuntime>;

function readMap(): RuntimeMap {
  try {
    const raw = localStorage.getItem(LS_RUNTIME);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as RuntimeMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: RuntimeMap): void {
  try {
    localStorage.setItem(LS_RUNTIME, JSON.stringify(map));
  } catch {
    /* приватний режим або переповнене сховище — не критично */
  }
}

/** Повертає збережений стан будильника або `null`. */
export function getAlarmRuntime(id: string): AlarmRuntime | null {
  const item = readMap()[id];
  return item && typeof item === 'object' ? item : null;
}

/** Зберігає стан будильника (перезаписує повністю). */
export function saveAlarmRuntime(id: string, runtime: AlarmRuntime): void {
  const map = readMap();
  map[id] = runtime;
  writeMap(map);
}

/** Видаляє стан будильника (наприклад, коли його видалили). */
export function deleteAlarmRuntime(id: string): void {
  const map = readMap();
  if (!(id in map)) return;
  delete map[id];
  writeMap(map);
}
