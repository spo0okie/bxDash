# Архитектура хранилищ интервалов и периодов

> **Обновлено май 2026** после рефакторинга по [plans/simplify.md](../plans/simplify.md), Этап 8.
> Двусторонние ссылки `DashItem ↔ IntervalItem ↔ PeriodItem` УБРАНЫ. Связь теперь
> декларативная: период сам решает, какие элементы в него попадают, через computed-фильтрацию.

## Обзор

Система состоит из трёх уровней:

1. **IntervalItem** — недельные интервалы (плюс bucket с `end===null`)
2. **PeriodItem** — дневные/недельные периоды внутри интервалов
3. **DashItem** — элементы (задачи, работы, заявки), отображаемые в периодах

```
┌────────────────────────────────────────────────────────────────┐
│                     PeriodsStore                               │
│                                                                │
│  intervals: Map(id → IntervalItem)                             │
│  periods:   Map(start → PeriodItem)                            │
│  items:     ItemsMultiStore   (привязывается через             │
│                                attachItemsStore из ItemsMulti) │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IntervalItem (id=-4)                                   │   │
│  │  ┌──────────┐ ┌──────────┐       ┌──────────┐           │   │
│  │  │PeriodItem│ │PeriodItem│  ...  │PeriodItem│           │   │
│  │  │(day 1)   │ │(day 2)   │       │(day 7)   │           │   │
│  │  └──────────┘ └──────────┘       └──────────┘           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ...                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IntervalItem (id=5, bucket)                            │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         PeriodItem (end=null)                   │    │   │
│  │  │         Долгий ящик                             │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                            ▲
                            │  PeriodItem._pick(type, predicate) — computed
                            │  values(items[type].items).filter(filterItem & predicate)
                            │
                  ┌─────────┴──────────┐
                  │  ItemsMultiStore   │  (хранит DashItem'ы по типам)
                  │  task / job / ...  │
                  └────────────────────┘
```

Ключевое отличие от старой модели: **никто не «приписывает» элемент к периоду**. Периоды сами читают `items[type].items` через computed и оставляют те, чей `t` попадает в их `[start, end)`.

## TimeStore — источник истины о времени

**Назначение:** хранит текущее время и вычисляет границы недель.

**Ключевые поля (observable):**

- `today` — timestamp начала текущего дня (00:00 МСК)
- `monday0` — timestamp начала текущей недели (00:00 понедельника)
- `sunday0` — timestamp конца текущей недели (00:00 воскресенья)
- `weekMin`, `weekMax` — диапазон отображаемых недель (по умолчанию -4..+4)

**Методы:**

- `weekStart(id)` = `monday0 + weekLen * id`
- `weekEnd(id)` = `sunday0 + weekLen * id`
- `weeksRange(bucket)` — массив id недель `[weekMin..weekMax]`, при `bucket=true` ещё `+1` (для долгого ящика)

**Жизненный цикл:**

1. Создаётся при старте через `createStores()` ([StoreProvider.jsx](../src/Data/Stores/StoreProvider.jsx))
2. `updateTime()` запускается каждую секунду через `setInterval`
3. При смене дня обновляются `today`, `monday0`, `sunday0` (см. раздел «Порядок обновлений» ниже)

## PeriodsStore — контейнер интервалов

**Назначение:** управляет коллекцией `IntervalItem`, реагирует на изменения времени.

**Ключевые поля:**
- `intervals` — `observable.map(id → IntervalItem)`
- `periods` — `observable.map(start → PeriodItem)` — все периоды всех интервалов
- `items` — ссылка на `ItemsMultiStore` (устанавливается через `attachItemsStore` из конструктора `ItemsMultiStore`)

### Конструктор

```javascript
constructor(main, layout, time) {
    this.weeksInit();

    observe(time, 'weekMin', () => this.weeksInit());
    observe(time, 'weekMax', () => this.weeksInit());
    // При смене "сегодня" — границы недель могли поплыть (вс->пн), пересобираем.
    // Элементы перепривяжутся сами через computed (зависит от item.t и period.start/end).
    observe(time, 'today', () => this.weeksInit());
}
```

### weeksInit()

```javascript
weeksInit() {
    const weeks = this.time.weeksRange(true);  // [-4, ..., 4, 5]

    weeks.reverse().forEach(id => {
        if (has(this.intervals, id)) {
            get(this.intervals, id).init();           // обновляем существующий
        } else {
            set(this.intervals, id, new IntervalItem(id, this.main, this.time, this.layout, this));
        }
    });

    keys(this.intervals).forEach(id => {
        if (!weeks.includes(id)) this.deleteInterval(id);
    });
}
```

`deleteInterval(id)` зовёт `interval.destroy()` (освобождает свои периоды) и удаляет интервал из карты. Никаких `beforeDelete`/`emergency`-флагов больше нет — элементы автоматически переедут в новые периоды через computed.

## IntervalItem — недельный интервал

**Назначение:** группирует периоды по неделям. **НЕ хранит** элементы — они живут в общем `ItemsMultiStore`, фильтрация идёт на уровне `PeriodItem`.

**Ключевые поля:**

- `id` — номер недели относительно текущей (0 = текущая, -1 = прошлая, +1 = следующая)
- `start`, `end` — границы интервала (`end===null` для bucket)
- `today` — копия `time.today` на момент инициализации
- `periodsIds` — массив start-ов своих периодов
- `expand` — кэш `layout.expand` (для отслеживания смены раскладки)
- `itemsTypes` — список типов из реестра ([Data/itemTypes.jsx](../src/Data/itemTypes.jsx))

**Геттер:**
- `get items()` → `this.periods.items` — короткий путь к корневому хранилищу элементов; используется в `PeriodItem._pick`.

### Создание (constructor)

```javascript
constructor(id, main, time, layout, periods) {
    this.id = id;
    this.time = time;
    this.layout = layout;
    this.periods = periods;
    this.itemsTypes = main.itemsTypes;
    this.init();

    observe(layout, 'expand', () => {
        if (this.layout.expand !== this.expand) this.reinitPeriods();
    });
}
```

### init() — обновление границ

```javascript
init() {
    const start = this.time.weekStart(this.id);
    const end = this.id > this.time.weekMax ? null : this.time.weekEnd(this.id);
    const today = this.time.today;

    if (this.start !== start || this.end !== end || this.today !== today) {
        this.start = start;
        this.end = end;
        this.today = today;
        this.reinitPeriods();
    }
}
```

Никаких `reintervalItems`/`reperiodItems`/`findItems` больше нет — элементы перепривязываются сами через computed.

### reinitPeriods() — пересоздание периодов

```javascript
reinitPeriods() {
    this.expand = this.layout.expand;
    const len = this.layout.expand ? TimeHelper.dayLen : TimeHelper.weekLen;

    this.periodsIds.forEach(t => this.periods.deletePeriod(t));
    this.periodsIds = [];

    if (this.end === null) {
        // Bucket — один период без конца
        const period = new PeriodItem(this.start, null, this);
        this.periods.setPeriod(period);
        this.periodsIds.push(this.start);
    } else {
        // Обычный интервал — периоды по дням или неделя целиком
        for (let t = this.start; t < this.end; t += len) {
            const period = new PeriodItem(t, len, this);
            this.periods.setPeriod(period);
            this.periodsIds.push(t);
        }
    }
}
```

### destroy() — освобождение перед удалением

```javascript
destroy() {
    this.periodsIds.forEach(t => this.periods.deletePeriod(t));
    this.periodsIds = [];
}
```

### filterItem(item) — попадает ли элемент в интервал

Из миксина [PeriodItemsMixin.jsx](../src/Data/Stores/Periods/PeriodItemsMixin.jsx) (общий для `IntervalItem` и `PeriodItem`):

```javascript
filterItem(item) {
    if (item.t === null) return this.end === null;     // bucket принимает t=null
    if (item.t < this.start) return false;
    if (this.end === null) return true;                  // bucket принимает всё что после start
    return item.t < this.end;
}
```

## PeriodItem — период внутри интервала

**Назначение:** отображает временной период (день или неделю) и через computed-выборку даёт элементы для рендера.

**Ключевые поля:**

- `start` — начало периода
- `len` — длина (`dayLen`, `weekLen` или `null` для bucket)
- `end` = `start + len` (или `null`)
- `type` — `'day'` | `'week'`
- `title`, `className`, `dropTime`, `toolTip` — для отображения и DnD
- `isOpen`, `isClosed`, `isToday` — флаги стилизации
- `interval` — ссылка на родительский `IntervalItem`
- `dragOverCell` (observable) — id ячейки, над которой сейчас drag

### Создание

```javascript
constructor(start, len, interval) {
    this.interval = interval;
    this.time = interval.time;
    this.start = start;
    this.len = len;
    this.end = (len === null) ? null : start + len;
    this.timeInit();   // вычисляет title, className, isOpen/isClosed
    makeObservable(this, {
        dragOverCell: observable,
        setDragOverCell: action,
        className: observable,
        closedTasks: computed,
        openedTasks: computed,
        closedJobs: computed,
        openedJobs: computed,
        closedTickets: computed,
        openedTickets: computed,
        plans: computed,
        itemsByUser: computed,
    });
}
```

`timeInit()` вызывается только в конструкторе — при смене `today` PeriodItem пересоздаётся через `IntervalItem.reinitPeriods()`.

### Декларативная выборка элементов

Один параметризованный метод вместо семи копий:

```javascript
_pick(type, predicate) {
    const items = this.interval.items;
    if (!items) return [];
    const store = items[type];
    if (!store) return [];
    const out = [];
    values(store.items).forEach(item => {
        if (!this.filterItem(item)) return;   // зависимость от item.t
        if (!predicate(item)) return;
        void item.sorting;                    // явная зависимость для сортировки
        out.push(item);
    });
    return out;
}

get closedTasks()   { return this._pick('task',   i => i.isClosed); }
get openedTasks()   { return this._pick('task',   i => !i.isClosed); }
get closedJobs()    { return this._pick('job',    i => i.isClosed); }
get openedJobs()    { return this._pick('job',    i => !i.isClosed); }
get closedTickets() { return this._pick('ticket', i => i.isClosed); }
get openedTickets() { return this._pick('ticket', i => !i.isClosed); }
get plans()         { return this._pick('plan',   () => true); }
```

Семёрка геттеров оставлена ради читабельности — потребители рендера ходят за ними по имени.

### Индекс по пользователям

Один проход по элементам периода вместо отдельной фильтрации в каждой `UserCell`:

```javascript
get itemsByUser() {
    const accomplicesVisible = this.interval.layout.accomplicesVisible;
    const map = new Map();
    const ensure = uid => { /* map.get/set { closedTasks, openedTasks, ... } */ };

    const placeTask = (task, bucket) => {
        ensure(task.user)[bucket].push(task);
        if (!accomplicesVisible) return;
        (task.accomplices ?? []).forEach(a => {
            if (a !== task.user) ensure(a)[bucket].push(task);
        });
    };

    this.openedTasks.forEach(t => placeTask(t, 'openedTasks'));
    this.closedTasks.forEach(t => placeTask(t, 'closedTasks'));
    this.openedJobs.forEach(j => ensure(j.user).openedJobs.push(j));
    this.closedJobs.forEach(j => ensure(j.user).closedJobs.push(j));
    this.openedTickets.forEach(tk => ensure(tk.user).openedTickets.push(tk));
    this.closedTickets.forEach(tk => ensure(tk.user).closedTickets.push(tk));
    this.plans.forEach(p => ensure(p.user).plans.push(p));

    return map;
}
```

`UserCellContainer` берёт `period.itemsByUser.get(userId)` — без повторного прохода по `accomplices`.

## DashItem — элементы задач/работ/заявок

**Назначение:** представляет бизнес-сущности (задачи, работы, заявки, планы, мемо, отсутствия).

**Ключевые поля для позиционирования:**

- `t` — timestamp, к которому элемент относится. Только это поле определяет, в какой период элемент попадёт.
- `deadline`, `closedDate`, `isClosed`, `isOpen` — исходники, из которых вычисляется `t` в `recalcTime()`.

> Полей `intervalId`/`periodId` больше **нет**. Методов `findInterval/setInterval/findPeriod/setPeriod/unsetX` тоже **нет**. Элемент не «знает», в каком периоде он находится — это решает сам период через `_pick`.

### recalcTime()

Базовая реализация в [DashItem.jsx](../src/Data/Models/DashItem.jsx):

```javascript
recalcTime() {
    if (this.deadline) {
        this.deadlineObj = TimeHelper.objDate(this.deadline);
        this.deadlineStr = ...;
    } else this.deadlineStr = 'нет срока';

    if (this.closedDate) {
        this.closedDateObj = TimeHelper.objDate(this.closedDate);
        this.closedDateStr = ...;
    } else this.closedDateStr = '';

    if (this.closedDate !== null) {
        this.t = this.closedDate;
        this.isClosed = true;
        this.isOpen = false;
    } else {
        // Открытый: позиционируем по deadline; просрочка съезжает на today
        this.t = this.deadline ? Math.max(this.deadline, this.context.time.today) : null;
        this.isClosed = false;
        this.isOpen = true;
    }
}
```

Подклассы (`TaskItem`, `TicketItem`, `PlanItem`, `MemoItem`) переопределяют `recalcTime()` под свою семантику статуса/времени. Никто из них больше **не зовёт** `findInterval()`.

Когда `recalcTime()` обновляет `this.t` — все computed-геттеры периодов, которые зависят от этого item, инвалидируются автоматически. Элемент «переезжает» в правильный период без императивных шагов.

## Поток данных при смене today

```
1. time.overrideDate(newTimestamp)  — или updateTime() при смене суток
   ↓
2. Сначала обновляются monday0 и sunday0,
   потом today (см. "Порядок обновлений" ниже)
   ↓
3. observe(time, 'today') в PeriodsStore → weeksInit()
   ↓
4. Для каждого существующего IntervalItem: init()
   - если start/end/today изменились → reinitPeriods()
     (старые PeriodItem удаляются, новые создаются с новым start/end)
   ↓
5. observe(time, 'today') в ItemsStore → recalcPeriods()
   - для каждого item: recalcTime() (пересчёт t с учётом нового today)
   ↓
6. Computed-геттеры PeriodItem._pick / itemsByUser автоматически
   пересчитываются — реактивная перепривязка элементов к новым периодам.
```

Никакого `reintervalItems`/`reintervalAllItems` больше нет. Элемент с просроченным deadline (вчера) сегодня сдвинется на новый `today`, и computed периодов сами увидят его в правильной ячейке.

## Порядок обновлений today/monday0/sunday0 (КРИТИЧНО)

**Проблема:** если `today` обновляется ДО `monday0`/`sunday0`, то `observe(time, 'today')` сработает в момент, когда `monday0` ещё содержит старое значение. `weeksInit()` прочитает рассогласованную пару → границы интервалов посчитаются неверно.

**Решение:** в `overrideDate()` и `updateTime()` всегда обновлять `monday0` и `sunday0` ПЕРВЫМИ, а `today` — ПОСЛЕДНИМ:

```javascript
overrideDate(timestamp) {
    // Сначала вычисляем все значения
    let m0 = ...;  // новый monday0
    let s0 = ...;  // новый sunday0
    let d0 = timestamp;  // новый today

    // monday0 и sunday0 — первыми
    this.monday0 = m0;
    this.sunday0 = s0;

    this.day = d;
    this.month = M;
    this.year = Y;
    this.wday = w;

    // today — последним: на него подписан PeriodsStore
    this.today = d0;
}
```

То же относится к `updateTime()` — `today` обновляется последним.

## Рекомендации по отладке

В dev-сборке стораджи доступны через `window.*` (см. [App.jsx](../src/App.jsx) — экспорт под `import.meta.env.DEV`):

```javascript
// Сдвинуть "сегодня" для проверки перестройки layout
window.timeStore.overrideDate(new Date('2026-02-15').getTime());

// Состояние интервалов
window.periodsStore.intervals.forEach((interval, id) => {
    console.log(`Interval ${id}: start=${interval.start}, end=${interval.end}`);
});

// Какие задачи попадают в конкретный период
const period = window.periodsStore.periods.get(window.timeStore.monday0);
console.log('opened tasks:', period.openedTasks);
console.log('items by user:', period.itemsByUser);

// Конкретная задача — её время t (привязки к периоду в самом item больше нет)
const task = window.itemsStore.task.items.get(123);
console.log(`Task t=${task.t} (${new Date(task.t).toISOString()})`);
```

## Почему так

Подробное обоснование декларативного подхода — в [plans/simplify.md](../plans/simplify.md), Этап 8 («Декларативный поток items↔periods через computed»). Кратко: императивные двусторонние ссылки требовали ручного `attach/detach` при каждом изменении `t`/`deadline`/`status` и порождали целый класс багов («элемент потерялся при смене today»). Декларативные computed снимают эту работу — MobX сам пересчитывает выборки при изменении зависимостей.
