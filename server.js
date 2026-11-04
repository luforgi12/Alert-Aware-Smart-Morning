import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dotenv.config({ path: '.server.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// Allow your Vite dev server origin
app.use(cors({
  origin: process.env.VITE_CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API proxy endpoint for alerts - reads token from server .env (NOT VITE_ prefix!)
const SERVER_ALERTS_KEY = process.env.ALERTS_API_KEY;
if (!SERVER_ALERTS_KEY) {
  console.warn('⚠️  ALERTS_API_KEY not set in server environment. The /api/alerts endpoint will return an error.');
}

// Клієнт питає, чи налаштований ключ на сервері (сам токен не розкривається).
app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ alerts: Boolean(SERVER_ALERTS_KEY) });
});

// alerts.in.ua дозволяє не більше 12 запитів на хвилину. Кешуємо відповідь,
// щоб кілька вкладок і ручні оновлення не вичерпували ліміт.
const CACHE_TTL_MS = 25_000;
let cache = { data: null, fetchedAt: 0 };
let inFlight = null;

async function fetchAlerts() {
  const response = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVER_ALERTS_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Alerts API error:', response.status, errorText);
    // Якщо upstream тимчасово недоступний (напр. 429), віддаємо останні
    // успішні дані, щоб індикатор не «блимав» у «Немає даних».
    if (cache.data) return { data: cache.data, stale: true };
    return { error: 'Failed to fetch alerts', status: response.status };
  }

  const data = await response.json();
  cache = { data, fetchedAt: Date.now() };
  return { data, stale: false };
}

async function getAlerts() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { data: cache.data, stale: false, cached: true };
  }

  // Одночасні запити від різних клієнтів чекають на один похід в API.
  if (!inFlight) {
    inFlight = fetchAlerts().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

// API proxy endpoint for alerts
app.get('/api/alerts', async (req, res) => {
  if (!SERVER_ALERTS_KEY) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  try {
    const result = await getAlerts();
    if (result.error) {
      return res.status(result.status || 502).json({ error: result.error, status: result.status });
    }

    res.set('Cache-Control', 'no-store');
    if (result.stale) res.set('X-Alerts-Stale', '1');
    res.json(result.data);
  } catch (error) {
    console.error('Proxy error:', error);
    if (cache.data) {
      res.set('Cache-Control', 'no-store');
      res.set('X-Alerts-Stale', '1');
      return res.json(cache.data);
    }
    res.status(500).json({ error: 'Internal proxy error' });
  }
});

// У продакшні цей самий сервер роздає зібраний фронтенд із dist/.
const distDir = join(dirname(fileURLToPath(import.meta.url)), 'dist');
if (existsSync(join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
} else {
  console.log('ℹ️  dist/ not found — run "npm run build" for the production UI.');
}

app.listen(PORT, () => {
  console.log(`🛡️  Alerts proxy server running on http://localhost:${PORT}`);
  console.log(`🔑 Server reads token from ALERTS_API_KEY (not exposed to clients)`);
  console.log(`📡 Frontend should call: http://localhost:${PORT}/api/alerts`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
