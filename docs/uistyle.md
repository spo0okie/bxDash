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
