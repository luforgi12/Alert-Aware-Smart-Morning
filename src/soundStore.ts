import type { AlarmMelody } from './types';

/** Максимальна тривалість власної мелодії. */
export const MAX_MELODY_SECONDS = 30;

/** Запобіжник за розміром файлу — 5 МБ (30 с MP3 навіть у 320 кбіт/с ≈ 1.2 МБ). */
export const MAX_MELODY_BYTES = 5 * 1024 * 1024;

const DB_NAME = 'alert-aware-sounds';
const DB_VERSION = 1;
const STORE = 'alarm-melodies';

/** Відкриває (за потреби створює) базу IndexedDB для мелодій. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB недоступна'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Помилка IndexedDB'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error('Помилка IndexedDB'));
      })
  );
}

/** Зберігає MP3-файл мелодії для конкретного будильника. */
export async function saveAlarmMelody(alarmId: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (store) => store.put(blob, alarmId));
}

/** Повертає збережений MP3-файл мелодії або `null`. */
export async function getAlarmMelody(alarmId: string): Promise<Blob | null> {
  try {
    const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(alarmId));
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

/** Видаляє мелодію будильника зі сховища. */
export async function deleteAlarmMelody(alarmId: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(alarmId));
  } catch {
    /* не критично: мелодія просто залишиться в сховищі */
  }
}

/** Секунди у формат `0:07` / `1:23`. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Чи схожий файл на MP3 (MIME-тип інколи порожній, тому перевіряємо ще й розширення). */
function isMp3(file: File): boolean {
  return file.type === 'audio/mpeg' || file.type === 'audio/mp3' || /\.mp3$/i.test(file.name);
}

/**
 * Визначає тривалість аудіофайлу через метадані.
 * Деякі MP3 не віддають тривалість одразу — тоді пробуємо seek у кінець.
 */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.onloadedmetadata = null;
      audio.ondurationchange = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      fn();
    };

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('Не вдалося прочитати файл. Спробуйте інший MP3.')));
    }, 15000);

    const tryResolve = () => {
      // Запам'ятовуємо значення ДО cleanup: audio.load() у finish() скидає duration у NaN.
      const value = audio.duration;
      if (Number.isFinite(value) && value > 0) {
        finish(() => resolve(value));
      }
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        tryResolve();
      } else {
        // Хитрість для MP3 з невідомою тривалістю: seek далеко вперед
        // змушує браузер дорахувати довжину.
        try {
          audio.currentTime = Number.MAX_SAFE_INTEGER;
        } catch {
          finish(() => reject(new Error('Не вдалося визначити тривалість мелодії.')));
        }
      }
    };
    audio.ondurationchange = tryResolve;
    audio.onerror = () => finish(() => reject(new Error('Файл пошкоджений або не є аудіо.')));
    audio.src = url;
  });
}

/**
 * Перевіряє файл і повертає дані для збереження.
 * Кидає помилку з текстом для користувача, якщо файл не підходить.
 */
export async function prepareAlarmMelody(
  file: File
): Promise<{ blob: Blob; melody: AlarmMelody }> {
  if (!isMp3(file)) {
    throw new Error('Підтримується лише формат MP3.');
  }
  if (file.size === 0) {
    throw new Error('Файл порожній.');
  }
  if (file.size > MAX_MELODY_BYTES) {
    throw new Error('Файл завеликий (максимум 5 МБ).');
  }

  const duration = await readAudioDuration(file);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Не вдалося визначити тривалість мелодії.');
  }
  if (duration > MAX_MELODY_SECONDS) {
    throw new Error(
      `Мелодія триває ${formatDuration(duration)} — максимум ${MAX_MELODY_SECONDS} с. Обріжте файл і спробуйте знову.`
    );
  }

  return {
    blob: file,
    melody: {
      fileName: file.name,
      duration,
      size: file.size,
    },
  };
}
