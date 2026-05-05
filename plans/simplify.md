# План архитектурного упрощения dashboard

## Статус

Этапы 1–9 ✅ выполнены (см. отметки `[x]` ниже). Один sub-item Этапа 2 (`destroy()`-цикл стораджей) отложен — некритичен для production, актуален только для тестов и HMR-чистоты. Этап 10 (косметика — переименование `.jsx → .js` и централизованный Logger) отложен полностью.

### Главные итоги по сложности
- **−400+ строк** по совокупности (DashItem 621→468, IntervalItem 192→95, PeriodItem 282→168, Layout 138→65, +удалён ItemsIdsStore).
- **Декларативный поток items↔periods**: больше нет `findInterval/setInterval/findPeriod/setPeriod/unsetX`, `attachItem/detachItem`, `reintervalItems/reperiodItems/reintervalAllItems`, `findItems`, `beforeDelete`, `emeregency`-флага. Период сам решает, какие элементы в него попадают (`PeriodItem.itemsByUser` computed).
- **Реестр типов** ([Data/itemTypes.jsx](src/Data/itemTypes.jsx)): один источник правды для `[task, ticket, job, plan, memo, absent]` — больше не размазан по 6 местам.
- **Фабрика стораджей** + `useStores()`: вместо module-scope синглтона.
- **LayoutStore.prefs** observable.map с авто-персистом — вместо 14 пар setX/saveOption.
- **Один индекс на Period** (`itemsByUser`): убрана двойная фильтрация Data→UserCellContainer.

## Обзор

План снимает основные источники сложности, выявленные при прочтении ключевых стораджей и рендер-цепочки. Этапы упорядочены так, чтобы каждый следующий опирался на упрощения предыдущего, а самые рискованные перестройки шли после того, как появятся точки сборки и тесты.

Ключевые принципы:
- сначала **подготовка** (реестр типов, фабрика стораджей) — снимает hardcode и даёт возможность писать тесты;
- потом **косметика** (LayoutStore, WsStore, дублирующиеся геттеры) — лёгкие победы, проверяющие подход;
- в конце **главная архитектурная ставка** — перевод связи `items ↔ periods` из императивной в декларативную (computed-only).

Каждый этап содержит раздел **«Неочевидные особенности»** — то, что текущая реализация учитывает (иногда неявно) и что легко сломать при упрощении.

---

## Этап 1. Реестр типов элементов

**Цель.** Убрать hardcoded списки `[task, ticket, job, plan, memo, absent]`, расползшиеся по 6 местам. Все циклы по типам должны строиться из одного источника.

### Что делаем
- [x] Создать `src/Data/itemTypes.jsx` с объектом `ITEM_TYPES`, описывающим для каждого типа: класс модели, периодичность авто-reload (мс), ws-событие и поле id в нём.
- [x] [`MainStore.itemsTypes`](src/Data/Stores/MainStore.jsx:24): заменить литеральный массив на `Object.keys(ITEM_TYPES)`.
- [x] [`ItemsStore.classMap`](src/Data/Stores/Items/ItemsStore.jsx:38): удалить, использовать `ITEM_TYPES[type].class`.
- [x] [`ItemsStore.init()`](src/Data/Stores/Items/ItemsStore.jsx:386): убрать `if (this.type==='task') ...` / `if (this.type==='ticket') ...`, читать `ITEM_TYPES[this.type].reloadMs`.
- [x] Поля `wsEvent`/`wsIdField` пока не используются — они «зарезервированы» для Этапа 4 (WsStore).

### Неочевидные особенности
- В `classMap` присутствует ключ `'dash'` → `DashItem`, хотя в `itemsTypes` его нет. Это fallback-класс (используется когда у элемента не определён конкретный type). При выкидывании `classMap` нужно сохранить fallback на `DashItem`.
- Reload-интервалы у `task` и `ticket` различаются (**5 мин и 2 мин**) — это отражает разную нагрузку на бэк и разную «свежесть» данных. Не унифицировать в одно значение.
- `memo` и `absent` НЕ имеют WS-событий — они либо обновляются по другим каналам, либо вовсе считаются «приклеенными» на куки. В реестре их `wsEvent` должен быть `null`/опущен.
- WS-поля id имеют **разные имена**: `taskId`, `jobId`, `ticketId`, но у плана — просто `id`. Это не опечатка, это контракт WS-сервера, ломать нельзя.
- `MainStore.itemsTypes` сейчас observable — это нужно сохранить, иначе сломается ленивая инициализация `ItemsMultiStore.types`.

### Риски
Минимальные. Изменения чисто организационные, набор объектов на старте не меняется. Достаточно проверить, что приложение запускается, видны все типы, и что reload по таймеру сохраняется.

---

## Этап 2. StoreProvider → фабрика, контекст в дереве

**Цель.** Отказаться от module-scope синглтонов. Сделать стораджи создаваемыми и передаваемыми через `<StoreContext.Provider>`. Дать возможность писать тесты с моками.

### Что делаем
- [x] В [`StoreProvider.jsx`](src/Data/Stores/StoreProvider.jsx) экспортировать `createStores({config})` и пустой `StoreContext`. Убрать создание на module load.
- [x] В [`App.jsx`](src/App.jsx) или [`index.jsx`](src/index.jsx) вызвать `createStores()` один раз и обернуть приложение в `<StoreContext.Provider value={stores}>`.
- [x] Экспорт в `window.*` перенести в `useEffect` корня под условие `import.meta.env.DEV`.
- [ ] Добавить `destroy()` цикл для всех стораджей с `setInterval` (BackendSystem, WsStore) и вызов на unmount корня. **Отложено** — корневой `<App>` не размонтируется в реальном использовании; критично только для тестов и HMR-чистоты.
- [x] Добавить хелпер-хук `useStore()` (или `useStores()`) — заменит распространённый `useContext(StoreContext)` + деструктуризацию.

### Неочевидные особенности
- Сейчас `ItemsMultiStore.attachItemsStore` вызывается ВНУТРИ конструктора `ItemsMultiStore` — это побочный эффект, который сейчас работает, потому что `PeriodsStore` уже существует к моменту вызова. При вынесении в фабрику порядок создания должен быть **строго сохранён**: `main → time → users → layout → periods → items (с attach внутри) → ws → alerts`.
- `WsStore` записывает себя в `items.ws = this` (см. [WsStore.jsx:59](src/Data/Stores/WsStore.jsx:59)). Это побочное связывание, которое легко потерять при рефакторинге.
- `BackendSystem` и `WsStore` запускают `setInterval` сразу в конструкторе. Без `destroy()` повторная инициализация (HMR, тесты) утечёт интервалы и WS-сокет. Цикл уничтожения обязателен.
- `window.onresize` устанавливается в `LayoutStore` глобально — переинициализация без снятия предыдущего обработчика затрёт его, но не удалит старый. Нужна `destroy()` и здесь.
- AuthForm рендерится на основании `main.bx.authStatus !== 'OK'` и т.д. — порядок проверок в `<Layout>` должен оставаться валидным сразу после создания стораджей (на старте все статусы — `Uninitialized` / `Unauthorized`, форма должна показаться).
- Существующая отладка через `window.timeStore` etc. — у разработчика возможно есть привычка ходить туда из консоли; нужно сохранить минимум на dev-сборке.

### Риски
Средние. Касается всего bootstrap'а. Нужно тщательно проверить порядок инициализации и реакцию на повторное создание (HMR).

---

## Этап 3. LayoutStore: 14 setX/X-полей → одна observable.map с автоперсистом

**Цель.** Заменить копипасту персистируемых булевых флагов одной коллекцией.

### Что делаем
- [x] Ввести в [`LayoutStore`](src/Data/Stores/LayoutStore.jsx) `prefs = observable.map()` (или сгруппированно `visibility`, `keep`, `dimensions`).
- [x] Описать `DEFAULTS = { tasksVisible:true, jobsVisible:true, ... }` — единое место значений по умолчанию.
- [x] Вместо 14 пар `setX/saveOption(...)` сделать один `setPref(key, value)` + `reaction` на `prefs` с автозаписью в куки.
- [x] При старте — пройти ключи и проинициализировать из `loadOption`.
- [x] Поправить компоненты, которые читают `layout.tasksVisible` etc. — оставить геттеры-обёртки `get tasksVisible() { return this.prefs.get('tasksVisible'); }` для совместимости (минимизация диффа).

### Неочевидные особенности
- `setSidebarWidth` имеет clamping `Math.max(150, Math.min(600, value))` — это не просто персист, это валидация. Нужно её сохранить либо в `setPref`, либо отдельным `setSidebarWidth` со специальной обработкой.
- `setModal` имеет нетривиальную логику с автоматическим `setModalVisible` на основании наличия `modal.content` — это не простой `set`, и не должен попасть под общую гребёнку.
- `windowDimensions` — `observable.struct` (не `observable`). Если положить в общую map — потеряется поверхностное сравнение, и любая «непохожая» ссылка будет триггерить рендер. Оставить отдельно.
- `expand` имеет default `true` (через `?? true`), но `accomplicesVisible` — `?? false`. Дефолты разные, в DEFAULTS должны быть точные значения.
- `memosVisible` имеет противоречие: в объявлении класса `= true`, в `loadOption('memosVisible') ?? false`. При сохранении умолчания нужно решить, что правильно (на bootstrap'е — `false`, как в loadOption). **Это потенциальный баг текущей реализации, не воспроизводить его, а вычистить.**
- Cookie-имена включают префикс `layout.` — при переименовании ключа потеряются настройки пользователей. Если меняем — только переименование с сохранением суффикса.

### Риски
Низкие. Чисто внутреннее упрощение. Главное — не сломать compat-обёртки для observers.

---

## Этап 4. WsStore.onMessage: switch → handler map по реестру типов

**Цель.** Использовать реестр из Этапа 1 для сборки обработчиков `*Update`-событий, оставить switch только для специальных событий (ping, techSupport*, phonesStatusUpdate, wsConnected).

### Что делаем
- [x] В [`WsStore.onMessage`](src/Data/Stores/WsStore.jsx:135) собрать map `{ taskUpdate: d => items.task.loadItem(d.taskId), ... }` через цикл по `ITEM_TYPES`.
- [x] Switch оставить только для системных событий, всё остальное — через map.
- [x] При неизвестном событии — `console.log('Unknown event', data)` (как сейчас).

### Неочевидные особенности
- Поле id у `planUpdate` называется `id`, а не `planId` — расходится с остальными. Без `wsIdField` из реестра — захардкодится не то имя.
- В switch `default` сейчас в `console.log` пишет `'Unknown event'` + дамп `data` — не удалять, это полезно для разбора нештатных сообщений.
- `phonesStatusUpdate` обрабатывает массив (`Object.entries(data.data).forEach`) — это не один updateItem, это пачка. Нельзя смешать с типовыми хендлерами.
- `ping` имеет побочный эффект — он апдейтит `users.updateConnection`, что в свою очередь зажигает «активность пользователя». Это не loadItem, это user-state.
- Если в реестре у типа `wsEvent: null` (memo, absent) — для них хендлер НЕ создаётся, иначе будем ловить на несуществующее событие.

### Риски
Низкие — мелкая локальная замена.

---

## Этап 5. PeriodItem: 7 копий computed-геттеров → 1 параметризованный

**Цель.** Убрать дублирование 7 геттеров `closedTasks/openedTasks/closedJobs/openedJobs/closedTickets/openedTickets/plans` в [PeriodItem.jsx:120-253](src/Data/Stores/Periods/PeriodItem.jsx:120).

### Что делаем
- [x] Ввести один computed `itemsByType`, возвращающий `{ task: {open, closed}, job: {open, closed}, ticket: {open, closed}, plan: [...] }` — структура зависит от семантики типа.
- [x] Совместимость: оставить `get openedTasks() { return this.itemsByType.task.open }` — тогда [Data.jsx](src/Components/Layout/Interval/Period/Data/Data.jsx) не трогаем.
- [x] **Удалить трюк `void task.sorting; void task.t`** — он работает потому что MobX-реактивность смотрит на чтение. Заменить на корректный computed (см. ниже).

### Неочевидные особенности
- **«Трогание» полей** (`void task.sorting; void task.t`) сейчас включает реактивность на изменения сортировки/времени. Если просто убрать — сортировка/перепрыгивание элементов перестанет реагировать на drag-n-drop. Заменять нужно либо аккуратной зависимостью внутри computed (если массив сортируется тут же), либо тем, чтобы эти поля действительно использовались.
- `plans` — единственный тип, у которого нет деления open/closed. Все планы рисуются всегда. В новой структуре это нужно сохранить.
- Computed читает `items[type].items` через `get(...)` (mobx Map API) — нельзя заменить на простой `this.context.items.task.items.get(id)`, т.к. сейчас items это `observable.map` MobX, и неправильный доступ убьёт реактивность.
- Сейчас порядок чтения: сначала `this.itemsIds.ids[type]` (массив id, обновляемый attach/detach) → потом `items[type].items.get(id)`. Этот двойной слой нужен потому, что `itemsIds` ведётся вручную (см. Этап 8). Пока Этап 8 не сделан — двойной слой остаётся.

### Риски
Низкие, если совместимость по геттерам сохранена. Главное — реактивность сортировки.

---

## Этап 6. DndHelper: dropOnItem + dropOnCell → одна функция

**Цель.** Убрать дубль из [DndHelper.jsx:48-206](src/Helpers/DndHelper.jsx:48). Различие — только в вычислении `newSort`.

### Что делаем
- [x] Выделить `computeNewSort(item, sourceList, targetList, dropTarget)` — один вход, две стратегии (на элемент / на пустое место).
- [x] Выделить `buildMoveParams(item, sourceCell, targetCell, newSort)` — одинаковая сборка `deadline/user/sorting/priority`.
- [x] `dashItemsDrop` остаётся точкой входа, ветвление выносится в `computeNewSort`.

### Неочевидные особенности
- В `dashItemNewSort` особо обрабатывается случай, когда первые элементы списка `isUnmovable` — они «выпиливаются» из списка перед расчётом индекса. Это нужно для того, чтобы планы (которые непереназначаемы и всегда вверху) не сбивали сортировку обычных задач.
- Защита от повторного drop на то же место (`samePlace`) — есть и в `dropOnItem`, и в `dropOnCell` с разными условиями. Не объединять механически — условия действительно разные.
- `confirmMove` на стороне DashItem — может прервать `update` после `movePosition`. Если в новой версии вызывать `update` напрямую — сломается UX подтверждения.
- `movePosition` ожидает наличие как минимум одного из меняющихся полей (deadline/user/sorting). Если все равны — внутри он вообще не вызывает `update`. Это нужно сохранить.
- Поле `priority` копируется в params **только если оно не null/undefined** в targetCell. В personal-bucket-режиме priority цели берётся из конфигурации интервала.

### Риски
Низкие. Чистый рефакторинг, легко покрыть юнит-тестами на чистых функциях.

---

## Этап 7. Layout.jsx разбивка + дубль splitBucket

**Цель.** Вынести из 138-строчного `Layout` хоткеи, модалки, calendar и правую панель в отдельные компоненты. Убрать тройной дубль splitBucket-bucket'а.

### Что делаем
- [x] Хук `useGlobalShortcuts(items)` — для Ctrl+K и Escape.
- [x] `<Modals/>` — рендер `ModalWindow` + `CreateTicketModal`.
- [x] `<CalendarGrid/>` — `weeksRange` + Bucket; `<RightPaneBucket/>` — то же для personal-режима. Внутри обоих — общий компонент `<BucketIntervals priority? />` (одна реализация раскладки bucket'а).
- [x] `<AppShell>` — header/sidebar/main composition.
- [x] `Layout` сжимается до ≤ 30 строк.

### Неочевидные особенности
- `ScrollSection` имеет id `'calendarGrid'` — на него завязан `LayoutStore.scrollTo` через `react-scroll`. **Нельзя переименовывать**.
- Правая панель `rightPane` имеет класс `x3` при `useSplitBucket` — это влияет на CSS-сетку. Класс должен сохраниться.
- `ScrollSection` ширина считается через хитрый расчёт `windowDimensions.width - (useSplitBucket?450:200) - (memosVisible?sidebarWidth:0)` — это компенсация для абсолютно-позиционированной правой панели. Не «сделать через flex», пока не понятна вся CSS-механика.
- AuthForm показывается при ИЛИ нет auth (`bx`/`zabbix`/`inventory`), ИЛИ нет WS, ИЛИ `debugVisible`. Условие сложное — оно отвечает за показ формы и в нормальных, и в отладочных кейсах.
- Хоткей Ctrl+K сейчас завязан на `items.task` напрямую (через `searchMode/clearSearch/setSearchMode`). Если поиск переедет в отдельный SearchStore (см. п. 4 первого ответа) — хоткей должен мигрировать вместе.

### Риски
Средние. Вёрстка/CSS-зависимости легко сломать.

---

## Этап 8. Декларативный поток items ↔ periods (главная ставка)

**Цель.** Убрать **императивное владение** элементов периодами/интервалами. Перевести `items ↔ periods` в чистые computed-вычисления MobX.

### Что меняется
- Удаляются методы `findInterval/setInterval/unsetInterval/findPeriod/setPeriod` на DashItem.
- Удаляется `ItemsIdsStore` целиком.
- Удаляются `attachItem/detachItem`, `reintervalItems/reperiodItems/reintervalAllItems/findItems`.
- Удаляется `attachItemsStore` цикл (см. Этап 2).
- На `PeriodItem` остаётся ОДИН computed `itemsByType` (см. Этап 5), который сам фильтрует `this.context.items[type].items` по `(t in [start, end])`.

### Что делаем
- [x] Описать в `PeriodItem`/`IntervalItem` чистые computed: `containsItem(item) → bool` (на основе `start/end/t`).
- [x] На `DashItem` сделать `get period() { return this.context.periods.findFor(this); }` — но СКОРЕЕ всего этот геттер вообще не нужен, потому что `PeriodItem` сам фильтрует.
- [x] На `IntervalItem` — `get items() { return all items where t in [start, end] }` через computed.
- [x] Снять `observe(time, 'today', ...) → reintervalAllItems()` — теперь периоды «сами» подхватывают изменения.
- [x] Снять `attachItem/detachItem` из `PeriodItemsMixin`.
- [x] Удалить `emeregency`-флаг — при чисто-computed подходе он не нужен (период просто исчезнет, элементы перейдут в другой computed).
- [x] Переписать `Period.closedTasks/openedTasks/...` через прямую фильтрацию (без `itemsIds`).

### Неочевидные особенности
- **`emeregency`-флаг** перед удалением интервала сейчас не даёт элементам «прицепиться» к удаляемому. В декларативном подходе порядок не важен: элемент просто переедет в новый интервал, как только старый исчезнет из `intervals`. **Но** нужно проверить, что нет рендер-кадра между «старый ушёл» и «новый создан», когда элемент окажется без периода и не отрендерится.
- **Bucket-period** (`len === null`, `end === null`) — это «долгий ящик», в него попадают элементы с `t === null`. Computed-фильтрация должна это явно обрабатывать (см. [PeriodItemsMixin.filterItem](src/Data/Stores/Periods/PeriodItemsMixin.jsx:5)).
- **Bucket с приоритетами** (`useSplitBucket`) — три разных «псевдо-интервала» с одним id, но разной priority. Это уже не работает в текущей `findInterval`-логике (там id один) — фильтрация по приоритету сейчас живёт в [Data.jsx:38-42](src/Components/Layout/Interval/Period/Data/Data.jsx:38). При переписывании bucket'а это нужно учесть в новой computed.
- **`isPlanItem()`** на DashItem рекурсивно ходит по `parents` — это не имеет отношения к интервалам напрямую, но используется при принятии решений о видимости/перетаскивании. Не зацепить.
- **Reintervaling on `today` change** (см. [PeriodsStore:159](src/Data/Stores/Periods/PeriodsStore.jsx:159)): при смене даты «сегодня» элементы со съезжающим `t` (просроченные → переходят на сегодня через `recalcTime`) должны перепривязаться. С computed это работает само (через зависимость от `time.today` в `t`-расчёте), но нужно убедиться, что сам `t` всё ещё пересчитывается через `recalcTime` (это не computed, а action).
- **`accomplicesVisible`** — задачи показываются у соисполнителей. Это уже фильтрация на уровне `UserCellContainer` и не меняется. Но если решим перенести фильтрацию по userId на уровень Period — нужно учесть, что один task может появиться у нескольких пользователей.
- **Плоны крепятся к концу недели** — это уже учтено в `t = deadline` после `recalcTime`. Не зацепить.
- **Sorting в ячейке** — `sorting` элемента + резерв `TimeHelper.getUnixtime()` если null. Это бизнес-логика, не относится к привязке к периоду, но ломать «двойной» проход (сортировка после фильтрации) нельзя.
- `isFlash`/`isHovered`/`isHoveredParent` — UI-состояние, остаётся на DashItem, не трогаем.

### Риски
Высокие. Это системное изменение, охватывающее >5 файлов и поведение ядра. Нужны:
- ручное тестирование сценариев: добавление недели, удаление недели, переход дня, drag-n-drop между ячейками, drag-n-drop в bucket, создание новой задачи, изменение deadline через WS, просрочка задачи (вчера → сегодня).
- желательно — playwright-тест на основные сценарии до начала переписывания.

### Стратегия пошагового выкатывания
1. Сначала **только Period**: переписать `closedTasks/openedTasks` через прямую фильтрацию `items.task.items`, оставив `itemsIds` нетронутым. Сравнить рендер.
2. Затем **отключить attach/detach** и проверить, что ничего не сломалось.
3. **Удалить ItemsIdsStore**.
4. **Снять find/set/unset** с DashItem.

---

## Этап 9. (опциональный) Двойная фильтрация Data → UserCell → один индекс

**Цель.** После Этапа 8 — переместить агрегацию `byUserId × byPriority` на уровень `PeriodItem`, чтобы `UserCellContainer` не делал второй проход фильтрации.

### Неочевидные особенности
- `accomplicesVisible` — задача попадает в ячейки нескольких пользователей. Индекс `byUserId` должен возвращать дубликаты или отслеживать accomplices отдельно.
- Этап имеет смысл делать только после 8 — иначе придётся переписывать дважды.

---

## Этап 10. (опциональный) Расширения файлов и логирование

- Переименовать `.jsx` → `.js` для не-React файлов (Stores, Models, Helpers).
- Ввести `Logger` с уровнями вместо россыпи `console.log`.

Дешёвая косметика, но трогает каждый файл — лучше делать отдельным PR в самом конце.

---

## Что делаем сейчас (этап 1)

Реестр типов. Минимально-инвазивно, без поведенческих изменений, готовит почву для этапов 4 и 8.
