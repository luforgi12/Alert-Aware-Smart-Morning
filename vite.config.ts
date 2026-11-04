import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_FILE = fileURLToPath(new URL('./API', import.meta.url));

/**
 * Читає токен alerts.in.ua з файлу "API".
 * Підтримує як `API_KEY=<token>`, так і просто токен одним рядком.
 */
function readApiKey(): string {
  try {
    const raw = readFileSync(API_FILE, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^(?:VITE_ALERTS_API_KEY|ALERTS_API_KEY|API_KEY|API)\s*=\s*(.*)$/);
      const value = (match ? match[1] : trimmed).trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  } catch {
    // Файл "API" відсутній — працюємо в ручному режимі.
  }
  return '';
}

const apiKey = readApiKey();

/** Перезапускає dev-сервер, коли змінюється файл "API". */
function apiKeyWatcher(): Plugin {
  return {
    name: 'api-key-watcher',
    configureServer(server) {
      server.watcher.add(API_FILE);
      server.watcher.on('change', (file) => {
        if (resolve(file) === resolve(API_FILE)) {
          server.config.logger.info('API key file changed, restarting server...', {
            timestamp: true,
          });
          server.restart();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiKeyWatcher()],
  define: {
    // Токен з файлу "API" доступний як глобальна константа __ALERTS_API_KEY__
    // (див. src/vite-env.d.ts). У dev-режимі запити йдуть через проксі на server.js,
    // тому токен у браузер не потрапляє.
    __ALERTS_API_KEY__: JSON.stringify(apiKey),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // Проксі для локального бекенду Express (server.js) у dev-режимі.
      // Фронтенд буде llamar /api/alerts, а Vite буде forwards до http://localhost:4000.
      '/api/alerts': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Оригінальний проксі для direktного доступу (тільки для dev, без ключа у коді).
      '/alerts-api': {
        target: 'https://api.alerts.in.ua',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/alerts-api/, ''),
      },
    },
  },
});