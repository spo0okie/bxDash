# Панель входящих вызовов и обратных звонков

Стек всплывающих сверху карточек: активные звонки текущего пользователя
(входящие/исходящие) и заявки на обратный звонок (callback / voicemail).
Данные — из ast22-phones; карточка пользователя — iframe из Inventory.

## Задача (что хотели)

Когда телефон текущего сотрудника меняет состояние (WSS-канал шлёт
`RINGING`/`INUSE`), показать выпадающую сверху карточку:

- **Активный звонок** — определить кто звонит/кому звонят (через ast22),
  найти сотрудника в Inventory по номеру, показать его view-карточку.
- **Заявки на обратный звонок** — периодически подтягивать pending/auto_done
  заявки, адресованные сотруднику, показывать в том же стеке.

Требования по UI/UX накапливались итеративно (см. «Что сделано»).

## Архитектура (где что лежит)

**Фронт (bxDash):**
- `src/Data/Stores/IncomingCallsStore.jsx` — весь стор: класс карточки
  `IncomingCall` + `IncomingCallsStore` (триггеры, polling, реконсиляция).
- `src/Components/Layout/IncomingCall/`
  - `IncomingCallsStack.jsx` — стек, рендерит `sortedCards`.
  - `IncomingCallCard.jsx` — карточка (шапка, вкладки, список записей, iframe).
  - `IncomingCall.css`.
- `src/Helpers/Ast22Helper.jsx` — авторизация в ast22 (Bearer).
- `src/Data/Stores/MainStore.jsx` — `this.ast22` BackendSystem.
- Конфиг: `incomingCall.*` в `src/config.priv.jsx` (+ `public/config.priv*.js`).
- Интеграция: `StoreProvider.createStores()`, `<IncomingCallsStack/>` в `Layout.jsx`,
  переключатели «входящие/исходящие» в `ControlPanel.jsx` + `LayoutStore` prefs.

**Бэкенды (доработки — их `plans/`):**
- ast22-phones (`C:\Joker\Works\ast22\ast22-phones\plans\`).
- Inventory/ARMS (`C:\Joker\Works\arms\`).

## Конфигурация (`incomingCall`)

| Ключ | Дефолт | Назначение |
|---|---|---|
| `enabled` | true | вкл/выкл фичу |
| `retryDelayMs` | 500 | задержка ретрая поиска активного звонка |
| `maxRetries` | 10 | попыток найти звонок (≈5с) |
| `iframeZoom` | 1 | масштаб содержимого iframe карточки |
| `callbackPollIntervalMs` | 60000 | период опроса заявок |
| `callbackAfterIdleMs` | 25000 | перечит заявок через N мс после ухода телефона в IDLE |
| `callbackAfterBusyMs` | 5000 | перечит заявок через N мс после перехода в INUSE |
| `sourceTimeOffset` | "+00:00" | пояс «голых» datetime от ast22 (прод отдаёт UTC) |
| `stubCallerNum` | null | заглушка caller_num без запроса ast22 (отладка) |

## Что сделано

### Инфраструктура
- Отдельный `BackendSystem('Ast22')` c Bearer-авторизацией (login →
  `POST /api/v1/auth/login` → accessToken; проверка — `/api/v1/auth/me`,
  availability — `/api/v1/health`). Единые креды с Bitrix/Inventory.
- URL берётся из `asteriskUrl` (это и есть REST API ast22).
- Индикатор доступности/авторизации ast22 в панели управления
  (`ConnectionStates`).

### Активные звонки
- Триггер: `reaction` на `phoneStatus` текущего пользователя;
  `IDLE→RINGING/INUSE` → `spawn()`.
- Направление определяется двумя параллельными запросами к ast22:
  `?status=active&callee_num=<my>` (входящий) и `?...&caller_num=<my>`
  (исходящий). Карточка добавляется в стек только когда звонок найден
  (иначе тихо отбрасывается — отсекает ringing-flap и звонки без записи).
- Вторая сторона: входящий → `caller_num`, исходящий → `callee_num`.
- Поиск пользователя в Inventory: `GET /web/api/phones/filter-by-num?num=`
  → массив пользователей (вкладки в шапке; iframe view-формы,
  `users/view?id=..&_layout=embed`).

### Заявки на обратный звонок (callback / voicemail)
- Опрос `GET /api/v1/callback-requests/search?status=<>&callee_num=<my>`
  по статусам `pending` и `auto_done` (два запроса) — периодически +
  по хукам after-idle / after-busy.
- **Группировка** по ключу `caller_num / callee_num / status`:
  все заявки одного номера с одним статусом → одна карточка-группа
  с множителем `×N`; pending и auto_done не смешиваются.
- **Реконсиляция**: сервер — источник правды. Каждый poll обновляет
  записи существующих групп, создаёт новые, удаляет исчезнувшие.
- **Дедуп с пропущенным**: если по `call_uuid` активного звонка уже есть
  callback-заявка — карточка пропущенного звонка удаляется (тот же iframe).
- **auto_done** (диалплан распознал ответ) — карточка зелёная.
  Закрытие → диалог «Отметить выполненными?» → `PUT /api/v1/callback-requests/<id>`
  `{status:done}` по каждой записи → карточка уходит и не грузится снова.
- **pending** — карточка оранжевая; кнопка закрытия **заблокирована**
  (заявку «закрывает» сам процесс обзвона: pending → auto_done → подтверждение).
- **voicemail** — строка записи с кнопкой Play; голосовые видны даже у
  свёрнутой группы (простые callback при сворачивании прячутся).
- **Проигрывание голосовых**: Play (▶/■) → строка-плеер `<audio controls>`
  под записью; URL = `voiceBaseUrl + '/<call_uuid>-voicemail.wav'` (сервис
  `http/elma365.php` ast22-phones, wav↔mp3 fallback на сервере). Один плеер
  на карточку; ошибка загрузки → message.error. Без `voiceBaseUrl` в конфиге
  кнопка disabled.
- **Номер обратного вызова редактируем** (в голосовом мог быть надиктован
  другой номер): в строке записи показывается `callback_num` (fallback —
  `caller_num`), у pending-записей кнопка ✎ → инлайн-правка → PUT
  `{callback_num}`; запись обновляется данными ответа (сервер — источник
  правды). Изменённый номер подсвечен (отличается от caller_num).
  Группировка карточек НЕ меняется — callback_num атрибут записи.
- **Click-to-call**: клик по номеру записи → подтверждение → POST
  `/api/v1/calls/originate` `{from: мой номер, to: номер записи}` (сначала
  звонит аппарат оператора, затем набор через штатный диалплан → auto_done
  отработает сам). Локально после originate ничего не меняем — статусы
  подтянет poll (after-busy хук). До выката API в ast22 деградирует мягко
  (ошибка → message.error).

### UI карточек
- Позиция под AppHeader (fixed), стек колонкой.
- Шапка: заголовок, множитель `×N`, время + тикающий счётчик «прошло»
  (мин. время; счётчик через `TimeHelper`/`time.strTime`, как SLA на тикетах).
- Свернуть/развернуть; при разворачивании остальные сворачиваются;
  iframe не перезагружается (`display:none`, а не размонтирование).
- **Двоякое время**: в шапке — минимальное (первый запрос) + отсчёт;
  для позиции в стеке — максимальное (свежая активность внизу).
- `expandBottom()` — развёрнута всегда нижняя (самая свежая) карточка;
  вызывается при реальных изменениях состава/записей (не на каждый poll).
- Высота iframe фиксирована 600px, масштаб `iframeZoom`, лоадер поверх.
- Переключатели «входящие»/«исходящие» в панели управления (persist в prefs).

### Время (важный нюанс)
- ast22 отдаёт datetime без TZ-метки; прод-Postgres в UTC → трактуем как
  UTC (`sourceTimeOffset="+00:00"`), отображаем через `TimeHelper` в
  выбранном поясе (МСК/локальный, реагирует на тумблер). См. память
  `reference_ast22_time_utc`.

## Доработки бэкендов (сделаны, в их `plans/`)

ast22-phones:
- `callback-requests-api.md` — search-эндпоинт заявок.
- `callback-requests-update-api.md` — PUT (закрытие в done).
- `calls-callees-array.md` — `callees text[]` + матчинг `@> ARRAY[:cn]`
  (входящие через диспетчерскую 5001 находятся по дежурному).
- `cors.md`, `api-router-prefix-fix.md`, `api-deny-no-redirect.md`,
  `cors-put-method-fix.md` — авторизация/CORS/маршрутизация REST.
- `timezone-utc-fix.md` — перевод БД в UTC (было America/New_York).
- `incoming-call-api.md` — активные звонки (реализовано как calls/search).

ast22-phones (новые, 2026-07):
- `callback-num-matching.md` — РЕАЛИЗОВАНО (строгий матч: auto_done закрывает
  ТОЛЬКО звонок на `callback_num`; после правки номера звонок на исходный
  caller_num заявку не закрывает — это осознанная семантика).
- `originate-api.md` — POST /api/v1/calls/originate (click-to-call через AMI
  Originate в штатный диалплан-контекст абонента; + право originate у
  ast22app). ЕЩЁ НЕ реализовано.
- Отдача голосовых — без ТЗ, доработан `http/elma365.php` и выкачен на прод
  (2026-07-08): URL `/<call_uuid>-voicemail.wav|mp3`, org_id по
  `callback_requests`, префикс location не важен (basename). На проде —
  AliasMatch `/records/...` на HTTPS-вхосте phones + SetEnv DB_*.

Inventory/ARMS:
- `phones/find-by-num`, `phones/filter-by-num` — поиск пользователей по
  номеру (см. память `reference_inventory_phones_api`).

## Что надо доделать

1. **Реализовать originate-api в ast22** (`plans/originate-api.md`) — фронт
   готов: до выката кнопка звонка (клик по номеру записи) вернёт ошибку,
   всё остальное работает.

2. **Группировка по всем адресатам (архитектурно).** Сейчас грузим только
   `callee_num = свой`, ключ группировки — пара номеров (вырожден в caller).
   На будущее — грузить все заявки, показывать целевые + визуализировать
   в ячейках пользователей; логика ключа уже пара, расширяется.

3. **Закрытие pending вручную.** Сейчас заблокировано намеренно. Если
   понадобится «снять» pending без обзвона — добавить путь (напр.
   `status=cancelled` через тот же PUT).

4. **Множественные одновременные звонки / call-waiting.** `reaction`
   срабатывает только на переход из не-incoming; второй звонок поверх
   разговора (INUSE→INUSE) карточку не поднимет. Пока не требовалось.

5. **Проверить хуки after-idle/after-busy на реальных таймингах** —
   значения (25с/5с) подобраны эмпирически, могут потребовать подстройки.

## Ключевые проверки перед релизом

- ast22 БД в UTC (иначе время плывёт).
- CORS: preflight на PUT/DELETE разрешён (методы в AuthController Cors).
- `asteriskUrl` в `public/config.priv.js` указывает на ast22 REST.
