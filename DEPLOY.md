# Публікація Alert-Aware

Фронтенд публікується на GitHub Pages, а Express (`server.js`) працює як
окремий API-сервер на Render. Браузер звертається до Render за URL,
налаштованою під час збірки фронтенду. Токен alerts.in.ua зберігається
**лише на сервері** у змінній `ALERTS_API_KEY` і ніколи не передається
браузеру.

## Що вже підготовлено

- `npm run build` — збірка фронтенду в `dist/`.
- `npm start` — запуск API-сервера (`node server.js`).
- `server.js` — проксі `/api/alerts`, конфіг `/api/config`, health `/health`,
  кеш 25 с + захист від ліміту 12 запитів/хв.
- `.github/workflows/deploy.yml` — автоматична публікація фронтенду на GitHub Pages.
- `render.yaml` — конфігурація API-сервера на Render.

## 1. API-сервер на Render

1. На [render.com](https://render.com) створіть **New → Blueprint** і підключіть
   цей GitHub-репозиторій. Render прочитає `render.yaml`.
2. У **Environment** сервісу задайте:
   - `ALERTS_API_KEY` = ваш токен з https://alerts.in.ua/api-request
   - `VITE_CORS_ORIGIN` = `https://luforgi12.github.io`
3. Переконайтеся, що налаштування сервісу такі:
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. Запустіть Deploy. Скопіюйте HTTPS URL сервісу, наприклад
   `https://alert-aware.onrender.com` (точна адреса показана в Render Dashboard).

> Безкоштовний тариф Render «засинає» після ~15 хв без трафіку. Поки вкладка
> застосунку відкрита, вона опитує API кожні 30 с і тримає сервіс активним.
> Якщо потрібна гарантована робота 24/7 — платний план або Railway/Fly.io.

## 2. Фронтенд на GitHub Pages

У GitHub репозиторії відкрийте **Settings → Secrets and variables → Actions →
Variables** і створіть repository variable:

- `VITE_API_BASE_URL` = HTTPS origin вашого Render-сервісу, наприклад
  `https://alert-aware.onrender.com` (без `/api` наприкінці).

Workflow `.github/workflows/deploy.yml` використовує цю змінну під час збірки.
Після push у `main` фронтенд опублікується автоматично. Якщо змінна не задана,
збірка не пройде — це запобігає публікації фронтенду з непідключеним API.
Також можна запустити workflow вручну через **Actions → Deploy to GitHub Pages
→ Run workflow**.

GitHub Pages має бути увімкнений у **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

## Перевірка після деплою

- `https://<render-домен>/health` → `{"status":"ok"}`
- `https://<render-домен>/api/config` → `{"alerts":true}`
- `https://<render-домен>/api/alerts` → JSON зі списком тривог
- Відкрийте сайт, виберіть область/район — індикатор має показати
  червоний/жовтий/зелений статус.

## Безпека

- `.server.env`, `API` — у `.gitignore`, у репозиторій не потрапляють.
- `ALERTS_API_KEY` задається **тільки** в середовищі Render — не в GitHub
  Actions, не у `VITE_*` змінній і не в коді фронтенду.
- `VITE_API_BASE_URL` — це публічна адреса API-сервера, не API-ключ.
- CORS на Render дозволяє запити з `https://luforgi12.github.io`.

## Локальний продакшн-прогін

```bash
npm run build
npm start          # http://localhost:4000 — API; фронтенд локально через npm run dev
```
