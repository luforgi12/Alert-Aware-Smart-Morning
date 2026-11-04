# Публікація Alert-Aware

Застосунок — це один Node.js-сервіс: Express (`server.js`) роздає зібраний
фронтенд із `dist/` і проксіює запити до alerts.in.ua. Токен зберігається
**лише на сервері** (змінна `ALERTS_API_KEY`) і не потрапляє в браузер.

## Що вже підготовлено

- `npm run build` — збірка фронтенду в `dist/`.
- `npm start` — запуск продакшн-сервера (`node server.js`).
- `server.js` — проксі `/api/alerts`, конфіг `/api/config`, health `/health`,
  кеш 25 с + захист від ліміту 12 запитів/хв.
- `Dockerfile` / `.dockerignore` — для VPS, Fly.io, Railway (Docker).
- `render.yaml` — готовий blueprint для Render.

## Варіант 1. Render (рекомендовано, безкоштовно)

1. Завантажте проєкт у GitHub:
   ```bash
   git remote add origin https://github.com/<ваш-логін>/alert-aware.git
   git push -u origin main
   ```
2. На [render.com](https://render.com): **New → Web Service** → підключіть репозиторій.
3. Налаштування:
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. **Environment → Add Environment Variable:**
   - `ALERTS_API_KEY` = ваш токен з https://alerts.in.ua/api-request
5. Deploy. Отримаєте HTTPS-адресу вигляду `https://alert-aware.onrender.com`.

> Безкоштовний тариф Render «засинає» після ~15 хв без трафіку. Поки вкладка
> застосунку відкрита, вона опитує API кожні 30 с і тримає сервіс активним.
> Якщо потрібна гарантована робота 24/7 — платний план або Railway/Fly.io.

## Варіант 2. Railway / Fly.io / VPS (Docker)

```bash
docker build -t alert-aware .
docker run -p 4000:4000 -e ALERTS_API_KEY=ваш_токен alert-aware
```

- Railway: **New Project → Deploy from GitHub** — Dockerfile підхопиться автоматично,
  додайте `ALERTS_API_KEY` у Variables.
- Fly.io: `fly launch`, потім `fly secrets set ALERTS_API_KEY=...`.
- VPS: поставте Docker (або Node 22), задайте `ALERTS_API_KEY` і тримайте
  процес через systemd/pm2; HTTPS — через Caddy/Nginx.

## Перевірка після деплою

- `https://<домен>/health` → `{"status":"ok"}`
- `https://<домен>/api/config` → `{"alerts":true}`
- `https://<домен>/api/alerts` → JSON зі списком тривог
- Відкрийте сайт, виберіть область/район — індикатор має показати
  червоний/жовтий/зелений статус.

## Безпека

- `.server.env`, `API` — у `.gitignore`, у репозиторій не потрапляють.
- На хостингу токен задається **тільки** через змінну середовища.
- Токен уже з’являвся у локальних файлах/листуванні — за потреби
  перевипустіть його на alerts.in.ua і оновіть `ALERTS_API_KEY`.
- CORS: для same-origin деплою нічого налаштовувати не треба. Якщо фронтенд
  окремо — задайте `VITE_CORS_ORIGIN=https://ваш-фронтенд`.

## Локальний продакшн-прогін

```bash
npm run build
npm start          # http://localhost:4000 — і UI, і API
```
