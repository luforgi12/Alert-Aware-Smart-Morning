import type { SafetyStatus } from './types';

// Запит завжди йде на власний бекенд (server.js): у dev — через Vite-проксі,
// на GitHub Pages — за VITE_API_BASE_URL до Render API.
// Токен ніколи не потрапляє в браузер.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';
const ALERTS_ENDPOINT = `${API_BASE_URL}/api/alerts`;

type AlertLevel = 'red' | 'yellow';

interface RawAlert {
  location_title?: string;
  location_type?: string;
  location_uid?: string | number;
  location_oblast?: string;
  location_oblast_uid?: string | number;
  location_raion?: string | null;
  alert_level?: AlertLevel;
}

export interface AlertsQuery {
  oblastUid: number;
  oblastName: string;
  districtUid: number | null;
  districtName: string | null;
}

export interface AlertFetchResult {
  status: SafetyStatus;
  level: AlertLevel | null;
  note: string | null;
}

/** Чи налаштовано токен alerts.in.ua на сервері. */
export async function hasAlertsKey(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.alerts);
  } catch {
    return false;
  }
}

/**
 * Повертає `null`, якщо отримати дані не вдалося.
 * null означає «невідомо» — будильник у такому разі не переноситься.
 */
export async function fetchAlertStatus(
  query: AlertsQuery
): Promise<AlertFetchResult | null> {
  try {
    const res = await fetch(ALERTS_ENDPOINT);
    if (!res.ok) return null;

    const data = await res.json();
    const alerts: RawAlert[] = Array.isArray(data?.alerts) ? data.alerts : [];

    const matches = alerts.filter((a) => belongsToSelection(a, query));

    if (matches.length === 0) {
      return { status: 'clear', level: null, note: null };
    }

    const level: AlertLevel = matches.some((a) => a.alert_level === 'red')
      ? 'red'
      : 'yellow';

    const titles = matches
      .map((a) => a.location_title?.trim())
      .filter((t): t is string => Boolean(t))
      .slice(0, 2);

    return {
      status: 'alert',
      level,
      note: titles.length > 0 ? titles.join(', ') : null,
    };
  } catch (err) {
    console.warn('Alerts API error:', err);
    return null;
  }
}

/**
 * Чи стосується тривога вибраної локації.
 * API не дає UID батьківської області для районів/громад (location_oblast_uid
 * дорівнює UID самої локації), тому область визначаємо за назвою.
 * - обрано район: тривога району, усієї області або громади в межах району;
 * - обрано лише область: будь-яка тривога в межах області.
 */
function belongsToSelection(alert: RawAlert, query: AlertsQuery): boolean {
  const title = alert.location_title?.trim() ?? '';
  const alertOblast = alert.location_oblast?.trim() ?? '';
  const inOblast = alertOblast === query.oblastName || title === query.oblastName;

  if (query.districtUid !== null) {
    if (Number(alert.location_uid) === query.districtUid) return true;
    if (alert.location_type === 'oblast') return inOblast;
    if (query.districtName) {
      if (title === query.districtName) return true;
      if (alert.location_raion?.trim() === query.districtName) return true;
    }
    return false;
  }

  return inOblast;
}
