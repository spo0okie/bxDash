# UI стиль дашбода

- Приложение должно с точки зрения UI/UX рабоать как диспетчерский экран ИТ отдела с максимальной плотностью информации и различимостью всех компонент и их статусов
- приоритет различия элементов должен быть следующим
	- тип элемента (задача/заявка/работа/...)
	- открыт/ожидает закрытия/закрыт
	- дополнительные статусы

## Инвентаризация UI и стилей bxDash

Этот документ фиксирует текущие UI-элементы, используемые компоненты и основные стили. Цель — дать опорную карту для внедрения тем (colors, фон, типографика, состояния).

## Глобальные стили

Глобальные стили и базовая типографика:
- `src/index.css`: базовый шрифт `Helvetica Neue/Helvetica/Arial`, размер 12px, цвет текста `#333`, фон `#666`, отступ сверху `47px`, `box-sizing: border-box` для `body`.
- `src/App.css`: общие правила для `iframe` (без границ/отступов) и дефолтные классы `App-header`/`App-link` (почти не используются в текущем UI).

## Карта UI (структура экрана)

Основной Layout:
- `Layout` фиксирует верхнюю шапку, модальные окна и основной контент.
- Слева — `Sidebar` (ресайз), по центру — `Calendar` (интервалы и периоды), справа — `rightPane` для персонального режима.
- В шапке — `AppHeader` и блок `UserList`.
- Кнопки переключателей (`HomeButton`, `MenuButton`) вынесены в фиксированные позиции.

## Дерево UI (срез по визуальным узлам)

Это «скелет» того, что пользователь видит на экране. Он нужен, чтобы понимать, где искать стили и как они наследуются.

1. `Layout`
2. `AppHeader`
3. `UserList`
4. `UserItem`
5. `UserAlerts`
6. `HomeButton`
7. `MenuButton` (мемо/опции/календарь/сплит-режим)
8. `Sidebar`
9. `MemoCell`
10. `Calendar` (ScrollSection)
11. `Interval`
12. `Period`
13. `PeriodTitle`
14. `PeriodData`
15. `UserCell`
16. `UserCellHeader`
17. `CardsBlock`
18. `TaskCard`
19. `JobCard`
20. `TicketCard`
21. `PlanCard`
22. `MemoCard`
23. `CreateItemButton`
24. `CreateTicketModal`
25. `ModalWindow`
26. `ConnectionStates`
27. `InvAuthForm`

## Статусы и визуальные состояния (по компонентам)

Ниже — перечень статусов, которые влияют на внешний вид, и где они описаны в CSS.

### Универсальные карточки (`li.userItem`)
Файл: `src/Components/Layout/Interval/Period/Data/UserCell/UserCell.css`
Состояния:
- `dragging`, `updating` (спиннер), `alert` (красный фон + shake), `flash` (мигающий фон), `hovered`, `parentTask`, `childTask`.
- `favorite` (фон-иконка `fav48.png`).

### TaskCard (`li.userTask`)
Файл: `src/Components/Items/ItemCards/Task/Task.css`
Состояния:
- Базовая задача: градиент `#f9f9f9 -> #e9e9e9`.
- `closeMe` (ожидает закрытия).
- `activeNow` (в работе, зеленая полоса).
- `closed` (завершено).
- `closed.negative` (негативная оценка).
- `dimmedOut` (чужая задача).
Доп. элементы:
- `taskPriority.low/mid/high` (приоритет).

### JobCard (`li.userJob`)
Файл: `src/Components/Items/ItemCards/Job/JobCard.css`
Состояния:
- `open` (в работе / открыта).
- `closed` (завершена).

### TicketCard (`li.userTicket`)
Файл: `src/Components/Items/ItemCards/Ticket/TicketCard.css`
Состояния:
- `red`, `green`, `blue` (статусы тикета).
- `closed` (закрыт).
Ссылки:
- `span.userTicketLink` с теми же статусами.

### PlanCard (`li.userPlan`)
Файл: `src/Components/Items/ItemCards/Plan/PlanCard.css`
Состояния:
- `authorized` / `denied`.
- `authorized.unknown` / `authorized.partial` / `authorized.failed` / `authorized.complete` (прогресс/результат).

### MemoCard (`li.userMemo`)
Файл: `src/Components/Items/ItemCards/Memo/MemoCard.css`
Состояния:
- `open` / `closed`.
- `expanded` / `compact` (развернут/свернут).

### UserItem (ячейка пользователя в шапке)
Файл: `src/Components/Layout/Header/UserList/UserItem.css`
Состояния:
- Отсутствия: `ABSENT`, `WEEK_ABSENT`, `TWO_WEEK_ABSENT`.
- Онлайн: `online`, `away`, `unavail`, `offline`.
- Телефон: `IDLE`, `RINGING`, `INUSE`, `UNKNOWN`, `UNAVAILABLE`.

### UserAlerts (значки алертов)
Файл: `src/Components/Layout/Header/UserList/UserAlerts.css`
Состояния:
- `severity1..severity5` (критичность).
- `active` / `inactive`, `pinned`.

### Period (временные полосы)
Файл: `src/Components/Layout/Interval/Period/Period.css`
Состояния:
- `period0..period7` (цветовые категории периодов).

### CreateItemButton (кнопки добавления)
Файл: `src/Components/Items/CreateItemButton/CreateItemButton.css`
Состояния:
- hover: `task`, `job`, `closedJob`, `ticket`, `plan`.

### Service-индикаторы и прочее
- `ConnectionStates` (`ConnectionStates.css`): `green/yellow/red`.
- `InvAuthForm` (`invAuthForm.css`): `hasErrors`, `warning`, `button.on/off`, `reset`.

## Инвентаризация компонентов (UI)

Layout и инфраструктура:
- `Layout`: `src/Components/Layout/Layout.jsx`, `Layout.css`.
- `AppHeader`: `src/Components/Layout/Header/AppHeader.jsx`, `AppHeader.css`.
- `UserList`, `UserItem`, `UserAlerts`: `UserList.css`, `UserItem.css`, `UserAlerts.css`.
- `Sidebar`: `src/Components/Layout/Sidebar/Sidebar.jsx`, `Sidebar.css`.
- `Interval`: `src/Components/Layout/Interval/Interval.jsx`, `Interval.css`.
- `Period`: `src/Components/Layout/Interval/Period/Period.jsx`, `Period.css`.
- `PeriodTitle`: `src/Components/Layout/Interval/Period/Title/Title.jsx`, `Title.css`.
- `PeriodData`: `src/Components/Layout/Interval/Period/Data/Data.jsx`, `Data.css`.
- `UserCell`, `UserCellContainer`, `UserCellHeader`: `UserCell.css`, `UserCellHeader.css`.
- `CardsBlock`: `CardsBlock.css`.
- `ScrollSection`: `src/Components/Layout/ScrollSection/ScrollSection.jsx` (inline style).
- `ModalWindow`, `ModalLink`: `ModalWindow.css` (переопределения AntD).
- `ConnectionStates`: `ConnectionStates.css`.
- `InvAuthForm` (панель логина/отладки): `invAuthForm.css`.
- Кнопки: `HomeButton.css`, `MenuIButton.jsx` (классы `on/off`, `memoButton`, `calendarButton`, `optionsButton`).

Items и карточки:
- `CreateItemButton`: `CreateItemButton.css` (кнопки добавления задач/работ/тикетов/планов).
- `CreateTicketModal`: AntD Modal + Select/Input, стили в основном AntD.
- `EditItem`: `EditItem.css` (textarea для редактирования).
- Карточки: `TaskCard` (`Task.css`), `JobCard` (`JobCard.css`), `TicketCard` (`TicketCard.css`), `PlanCard` (`PlanCard.css`), `MemoCard` (`MemoCard.css`).
- Ссылки: `TaskLink` (`Task.css`), `TicketLink` (`TicketCard.css`), `ParentLink` (без CSS).
- `MemoCell` использует общие карточки и `CreateItemButton` (без отдельного CSS).

## Ant Design компоненты

Используются следующие компоненты AntD:
- `Modal` (обычные и кастомные модальные окна).
- `Input.TextArea`.
- `Select`.
- `Tooltip`.
- `Dropdown`.
- `Button`.
- `message`.

В `ModalWindow.css` есть переопределение внутренних отступов `ant-modal-content`.

## Основные классы и состояния

Карточки и элементы:
- Базовый класс карточек: `li.userItem` (общие размеры, типографика, эффекты загрузки/ошибки/hover).
- Состояния: `dragging`, `updating`, `alert`, `flash`, `hovered`, `favorite`, `closed`, `open`, `activeNow`, `negative`, `closeMe`, `authorized`, `denied`, `partial`, `complete`.

Пользователи и статусы:
- `UserItem` и статусы присутствия: `ABSENT`, `WEEK_ABSENT`, `TWO_WEEK_ABSENT`.
- Онлайн-статусы: `online`, `away`, `unavail`, `offline`.
- Телефония: `IDLE`, `RINGING`, `INUSE`, `UNKNOWN`, `UNAVAILABLE`.

Периоды:
- `Period.period0..period7` задают цветовые полосы и фон заголовка периода.

## Цвета и визуальные токены (по факту текущих CSS)

Фон и базовые цвета:
- Фон страницы: `#666`.
- Основной цвет текста: `#333`.
- Шапка: `white` + тень `rgba(0,0,0,0.5)`.

Периоды и календарь:
- Периоды: `yellow`, `greenyellow`, `limegreen`, `deepskyblue`, `royalblue`, `blueviolet`, `darkslateblue`, `#333333`.
- Заголовок `UserCellHeader`: градиент `#787878 -> #2e2e2e`, акцентные цвета счетчиков: `#79bbff`, `red`, `#5cb811`, `#ffee66`, `blueviolet`, `#e9e9e9`.

Карточки:
- Task: градиенты `#f9f9f9 -> #e9e9e9`, закрытые `#007dc1 -> #0061a7`, негативные `#a83516 -> #852511`.
- Job: открытые `#ffec64 -> #ffab23`, закрытые `#77d42a -> #5cb811`.
- Ticket: фон `alum0.jpg`, закрытые `#79bbff -> #378de5`.
- Plan: фон `#444`/`#222`, границы прогресса `whitesmoke/yellow/red/green`.
- Memo: открытые `beige` + тень `rgba(0,0,0,.5)`, закрытые `#77d42a -> #5cb811`.

Алерты и статусы:
- Уровни критичности `severity1..5`: `#7499FF`, `#FFC859`, `#FFA059`, `#E45959`, `#891515`.
- Вспомогательные цвета: `lime`, `orange`, `red`, `gray`, `cyan`, `yellow`, `lightskyblue`.

Кнопки добавления:
- Hover цвета: `orange`, `yellow`, `lime`, `deepskyblue`, `mediumorchid`.

## Изображения и ассеты

Используются фоны:
- `/public/alum0.jpg` для тикетов.
- `/public/fav48.png` для избранного (фон контента карточки).

## Вывод для темизации

Сейчас визуальные параметры размазаны по множеству CSS файлов и инлайн‑стилям. Для внедрения тем удобнее:
- Ввести дизайн‑токены (CSS variables) для базовых цветов, градиентов, теней, границ и статусов.
- Сконцентрировать токены в одном месте (например `src/index.css` или отдельный `theme.css`).
- Свести AntD к тем же токенам через `ConfigProvider` (цвета, типографика, размеры).

---

## План архитектуры тем

Цель: дать пользователю возможность переключать «оформление», где под оформлением понимается **любой набор CSS-атрибутов** (цвета, градиенты, шрифты, размеры, отступы, радиусы, тени, фоновые картинки, анимации), а не только палитра. Темы должны быть переключаемы на лету, без перезагрузки, и переживать перезапуск приложения.

### 1. Общая идея

Архитектура строится на трёх слоях, которые работают согласованно:

1. **Дизайн-токены как CSS custom properties** — единственный источник правды для значений. Все CSS-файлы читают переменные `var(--token-name)`, а не литеральные `#79bbff`/`12px`/`5px solid`.
2. **`ThemeStore` (MobX)** — описывает текущую тему как объект, умеет её сохранить, загрузить, переключить и применить к DOM. Хранит активную тему в cookies через уже существующий `MainStore.saveOption/loadOption`.
3. **AntD `ConfigProvider`** — подписан на `ThemeStore`, прокидывает в AntD те же токены (цвета, шрифты, радиусы, размеры контролов), чтобы кнопки/модалки/инпуты не выпадали из темы.

Применение темы = одна операция: `ThemeStore` ставит атрибут `data-theme="..."` на `<html>` (или пишет переменные в `document.documentElement.style`) + обновляет токены AntD через провайдер. Никаких пересборок, никаких множественных `<link rel="stylesheet">`.

### 2. Что считать «темой» (структура данных)

Тема — это плоский объект токенов, разбитый на семантические группы. Любое CSS-свойство, которое сейчас зашито в `.css`, должно стать токеном. Предлагаемая таксономия (имена — рабочие):

**Поверхности и фон (surface)**
- `--surface-page` (фон body), `--surface-app-bar`, `--surface-sidebar`, `--surface-card`, `--surface-card-elevated`, `--surface-modal`, `--surface-overlay`.
- Картинки: `--surface-ticket-bg` (сейчас `alum0.jpg`), `--surface-favorite-icon` (сейчас `fav48.png`).

**Текст (text)**
- `--text-primary`, `--text-secondary`, `--text-inverse`, `--text-muted`, `--text-link`, `--text-on-accent`.

**Бренд / акценты (accent)**
- `--accent-primary`, `--accent-success`, `--accent-warning`, `--accent-danger`, `--accent-info`.

**Типографика (typography)**
- `--font-family-base`, `--font-family-mono`, `--font-size-base`, `--font-size-sm`, `--font-size-lg`, `--font-weight-regular`, `--font-weight-bold`, `--line-height-base`, `--letter-spacing-base`.

**Геометрия (shape & spacing)**
- `--radius-xs/sm/md/lg`, `--space-1..--space-6`, `--border-width-thin/thick`, `--container-max-width`.

**Тени и эффекты (effect)**
- `--shadow-sm/md/lg`, `--shadow-modal`, `--shadow-card-hover`.
- `--transition-fast/medium/slow`, `--easing-standard`.
- Анимации (имена): `--anim-shake`, `--anim-flash` — сами `@keyframes` остаются в CSS, но их параметры (длительность, цвет вспышки) — токены.

**Карточки и статусы (state)** — самая большая группа, нужна, чтобы темы могли менять не только цвет, но и логику оформления статусов:
- Task: `--task-bg-open`, `--task-bg-closed`, `--task-bg-negative`, `--task-bg-active-now`, `--task-stripe-active-now`, `--task-priority-low/mid/high`.
- Job: `--job-bg-open`, `--job-bg-closed`.
- Ticket: `--ticket-bg-base`, `--ticket-bg-red/green/blue/closed`, `--ticket-link-color-*`.
- Plan: `--plan-bg`, `--plan-border-unknown/partial/failed/complete`, `--plan-text-authorized/denied`.
- Memo: `--memo-bg-open`, `--memo-bg-closed`, `--memo-shadow`.
- Periods: `--period-0..--period-7-color`, `--period-0..--period-7-title-text`.
- UserItem: `--user-presence-online/away/unavail/offline`, `--user-absence-week/twoweek`, `--user-phone-idle/ringing/inuse/...`.
- Alerts: `--alert-severity-1..5`, `--alert-pinned-outline`.
- Connection: `--conn-green/yellow/red`.

**Скелетные правила (raw CSS overrides)** — для редких случаев, когда тема должна изменить не значение, а правило (например, скруглить все карточки или поменять gradient на solid). Реализуется через **«стилевые слоты»**: дополнительные классы на `<html>` (`theme-flat`, `theme-rounded`) либо через подключение дополнительного `*.theme.css`. Используется только там, где токенов недостаточно.

### 3. Манифест темы

Формат в коде (TypeScript/JSDoc-friendly):

```
{
    id: 'classic',                  // машинный идентификатор, попадает в cookie и в data-theme
    name: 'Классическая',           // человекочитаемое имя для UI-переключателя
    description: '…',
    extends: null | 'classic',      // наследование (тёмная = светлая + переопределения)
    tokens: { '--surface-page': '#666', '--text-primary': '#333', … },
    antd: {                         // подмножество, которое уйдёт в ConfigProvider.theme.token
        colorPrimary: '#1677ff',
        borderRadius: 4,
        fontFamily: '"Helvetica Neue", …',
        // + components: { Modal: { contentBg: 'var(--surface-modal)' }, … }
    },
    extras?: {                      // опционально — то, что не выражается токенами
        bodyClassName: 'theme-rounded',
        stylesheets: ['/themes/classic-extras.css'],
    },
}
```

Темы поставляются в `src/Themes/<id>/index.js` (плюс соседние `extras.css` при необходимости). Реестр — `src/Themes/registry.js`, экспортирует `availableThemes` массивом и `getTheme(id)`.

### 4. ThemeStore

Новый сторадж `src/Data/Stores/ThemeStore.jsx`, регистрируется в `createStores()` после `MainStore` (нужен для cookie-API).

Интерфейс:
- Observable: `currentThemeId`, `currentTheme` (computed), `availableThemes`.
- Действия: `setTheme(id)`, `init()` (читает cookie или дефолт), `applyToDOM()` (внутреннее).
- Реакция: `autorun`/`reaction` следит за `currentTheme` и:
    - проставляет `<html data-theme="...">`,
    - выставляет CSS-переменные (`document.documentElement.style.setProperty`) — нужно для динамических `extends` и для значений, которые невозможно задать в `:root`-блоке заранее,
    - подключает/отключает `extras.stylesheets` (создаёт/удаляет `<link>`),
    - вызывает колбэк, который синхронизируется с AntD `ConfigProvider` (через observable, который читает обёртка над `<App />`).
- Сохранение: при изменении `currentThemeId` — `mainStore.saveOption('theme', id)`.

### 5. AntD интеграция

В `App.jsx` (или новом `ThemeProvider.jsx`) оборачиваем дерево в `<ConfigProvider theme={…}>`. Значение берём из `themeStore.currentTheme.antd` через `observer`. Желательно прокидывать в AntD не литералы, а CSS-переменные, чтобы инлайн-стили AntD-компонентов тоже реагировали на смену темы:

```
<ConfigProvider theme={{ token: { colorPrimary: 'var(--accent-primary)', borderRadius: 6 } }}>
```

Для случаев, где AntD не принимает `var(...)` (есть такие токены — например, числовые `borderRadius`), — храним числовые значения отдельно в `theme.antd` и одновременно дублируем в CSS-переменные.

### 6. Способ применения CSS-переменных

Два эшелона:
1. **Базовый** — `:root { ... }` в `src/Themes/base.css`: дефолтные значения всех токенов. Это страховка: если новый компонент забыли затемизировать, он использует базовые значения.
2. **Темовый** — `[data-theme="dark"] { --surface-page: #111; ... }` в `src/Themes/<id>/tokens.css`. Подгружается всегда, переопределяет базовый слой по `data-theme`.

Динамические темы (например, пользовательская кастомная) — пишутся `style.setProperty` в `<html>` и не требуют CSS-файла.

### 7. Миграция существующих стилей

Большой кусок работы — заменить литералы в 27 CSS-файлах на `var(--token)`. План — поэтапно, по принципу «снизу вверх по визуальной иерархии», чтобы не сломать визуал на промежуточных коммитах:

**Этап 0 — каркас (без визуальных изменений)**
- Создать `src/Themes/base.css` со всеми токенами, значения = текущие литералы из CSS.
- Импортировать в `src/index.jsx` (один раз).
- Подключить пустой `ThemeStore`, реестр с одной темой `classic`.
- Обернуть `<App>` в `<ConfigProvider>` с токенами, продублированными из текущих неявных дефолтов AntD.
- Проверка: визуал идентичен.

**Этап 1 — глобальные токены**
- `src/index.css`, `src/App.css` → перевести `font-family`, `color`, `background-color`, `padding` на токены.
- `Layout.css`, `AppHeader.css`, `Sidebar.css` — поверхности и тени.

**Этап 2 — карточки**
- `Task.css`, `JobCard.css`, `TicketCard.css`, `PlanCard.css`, `MemoCard.css`, `UserCell.css`, `UserCellHeader.css`, `CardsBlock.css` — токенизировать градиенты, статусы, рамки, тени.
- Здесь же — заменить `url('/alum0.jpg')`, `url('/fav48.png')` на токены `var(--surface-ticket-bg)`/`var(--surface-favorite-icon)`.

**Этап 3 — статусы и периоды**
- `Period.css` — 8 цветов периодов в `--period-N-color` + `--period-N-title-text`.
- `UserItem.css`, `UserAlerts.css`, `ConnectionStates.css` — статусы присутствия/телефонии/алертов/коннекта.
- `CreateItemButton.css`, `HomeButton.css`, кнопки меню — hover-цвета и состояния.

**Этап 4 — модалки и формы**
- `ModalWindow.css`, `invAuthForm.css`, `EditItem.css`, `TaskSearch.css`, `SearchResults.css`, `Title.css`, `Interval.css`, `Data.css`.

**Этап 5 — инлайн-стили**
- 11 JSX-файлов с `style={...}` (`UserCellContainer`, `CalendarGrid`, `UserAlerts`, `CreateTicketModal`, `ModalWindow`, `UserCell`, `UserItem`, `AppHeader`, `UserList`, `Sidebar`, `ScrollSection`).
- Где значения статичные — выносить в CSS-классы, читающие токены.
- Где значения вычисляемые (зависят от данных) — оставлять inline, но строить через `var(--token)` (`style={{ background: 'var(--surface-card)' }}`) — браузер разрешит переменную при рендере.

**Этап 6 — UI переключателя темы**
- Кнопка / пункт меню (логичное место — `Menu` в `Header`), список тем из `themeStore.availableThemes`, превью имени, индикатор активной.
- Опционально: мини-форма «кастомная тема» (выбор палитры, шрифта, радиуса) с сохранением в cookie как `extends: <baseId> + tokens override`.

**Этап 7 — минимум две темы из коробки**
- `classic` (текущая) + `dark` (тёмный фон страницы, инвертированные тексты, приглушённые градиенты карточек, фон тикетов — однотонный, без `alum0.jpg`, либо альтернативная текстура).
- Опционально: `compact` (меньше отступов, мельче шрифты, меньшие радиусы) — демонстрирует, что тема меняет не только цвет.

### 8. Тестирование

- Юнит-тест на `ThemeStore`: смена темы → cookie обновился → `data-theme` на `<html>` сменился → реакция AntD-обёртки сработала.
- Визуальные тесты Playwright: на каждом ключевом экране (Layout с задачами, модалка создания тикета, авторизация) — два прогона на двух темах, screenshot diff в обе стороны.
- Smoke: все темы применяются без ошибок в консоли (особенно AntD warnings про несовместимые значения токенов).

### 9. Риски и тонкие места

- **Старая разметка iframe из Bitrix** (`AddLibrary` в `App.jsx`) — стили внутри `iframe` мы не контролируем. Тема не должна полагаться на согласованность с этим контентом.
- **AntD компоненты с порталами** (Modal, Tooltip, Dropdown) — рендерятся в `body`, но `data-theme` на `<html>` распространяется, проверить что `var(...)` читаются. AntD ≥5 уже поддерживает CSS-in-JS темизацию через `ConfigProvider`, но часть стилей идёт inline — отсюда необходимость задавать токены AntD явно.
- **Печать / экспорт** — если есть, темы могут ломать печатный вид. Задать `@media print` на нейтральные значения.
- **Cookie-конфликты** — выбрать имя `theme` или `bxd.theme`, чтобы не пересечься с существующими опциями `MainStore`. Проверить текущий список сохраняемых cookies.
- **Производительность** — `style.setProperty` на `documentElement` инвалидирует только зависимые правила, дешёвая операция. Однако массовое применение через JS (если не использовать классовый слой) — заметно медленнее, чем `data-theme` со статичным CSS. Рекомендация: предустановленные темы — через `[data-theme=…]`, кастомные — через `setProperty`.
- **Картинки в темах** — `url(...)` в `var(...)` работает, но синтаксис требует уже подготовленной строки `url('…')`. Стоит хранить токен как `--surface-ticket-bg: url('/alum0.jpg')`, а не как путь.
- **Анимации** — переопределение `@keyframes` через переменные ограничено: значение цвета в кейфрейме можно подменить (`background: var(--anim-flash-color)`), но саму последовательность кадров — нет. Если темам нужны разные анимации, использовать `extras.stylesheets`.

### 10. Что считать «готовым» (acceptance)

- Все литералы цветов / шрифтов / размеров вынесены в токены `base.css`. Проверка: `grep -nE '#[0-9a-f]{3,8}|rgb\(|rgba\(' src/**/*.css` возвращает только определения токенов.
- Переключение темы из UI меняет: палитру, шрифт, радиусы, тени, фон тикетов, оформление AntD-модалок и кнопок — без перезагрузки.
- Выбранная тема переживает F5 (читается из cookie при старте).
- Минимум 2 встроенные темы, отличающиеся не только цветом.
- Visual-regression Playwright проходит для всех тем.

### 11. Принятые решения

- **Пользовательская тема (UI-конструктор) не нужна.** Только набор предустановленных. Соответственно, в `ThemeStore` не требуется поддержка динамической записи токенов через `style.setProperty` — все темы реализуются через `[data-theme=...]` в CSS.
- **Кнопка переключения — в меню** (`MenuButton`, рядом с уже существующими `memoButton`/`calendarButton`/`optionsButton`). Список тем берётся из `themeStore.availableThemes`.
- **Тема глобальная.** Один cookie `theme` для всего приложения, не зависит от текущего пользователя. (Изначально планировалась per-user, но на практике это усложнило загрузку из cookie без видимой пользы — на одной машине обычно один пользователь.)
- **Следование `prefers-color-scheme` не нужно.** Тема меняется только явным выбором в меню.

Эти решения упрощают этап 6 миграции (нет UI-конструктора) и слегка усложняют этап 0 (`ThemeStore` должен знать про текущего пользователя — берёт из `UsersStore` или из контекста авторизации).
