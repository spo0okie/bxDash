---
name: verify
description: Как собрать, запустить и проверить bxDash в embedded-браузере (обход HTTPS dev-сертификата)
---

# Верификация bxDash

## Сборка
`npm run build` — vite, ~20 c. Предупреждение про chunk >500kB — норма.

## Запуск для embedded-браузера

Штатный dev-сервер (`npm run dev`, порт 3030) — HTTPS с сертификатом
portal.azimuth.holding.local; embedded-браузер такие origin'ы НЕ открывает
(навигация denied), а https://portal.azimuth.holding.local (боевой прокси)
требует per-action approval. Обход:

- `vite.verify.config.js` — копия vite.config.js без https/HMR-прокси, порт 3132;
- `.claude/launch.json` → конфигурация `bxdash-http`;
- `preview_start {name: "bxdash-http"}` → открыть `http://localhost:3132/reviakin/z2/`.

Порт 3030 обычно занят собственным dev-сервером пользователя — не трогать.

## Наблюдение

- Автологин включён (`debugAutoLogin: true` в public/config.priv.js) — приложение
  само авторизуется в Bitrix/Inventory/ast22/Zabbix. С localhost-origin Bitrix и
  Inventory могут быть Unreachable (CORS/прокси) — это артефакт окружения, ast22
  и Zabbix работают.
- Скриншоты через `computer` часто таймаутятся (тяжёлый рендер) — использовать
  `read_page` / `read_console_messages` / `javascript_tool`.
- В dev-сборке сторы доступны из консоли: `usersStore`, `mainStore`, `itemsStore`
  и т.д. (см. App.jsx) — удобно дёргать action'ы и смотреть DOM-реакцию.
- React.StrictMode в dev создаёт НЕСКОЛЬКО комплектов сторов (лишние не
  disposed) — периодические опросы (DutyStore, ScheduleStore) идут ×4;
  в prod-сборке экземпляр один. Не считать это багом опроса.
