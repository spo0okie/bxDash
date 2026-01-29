# Архитектура хранилищ интервалов и периодов

## Обзор

Система управления временными интервалами и периодами в bxDash состоит из трех уровней:

1. **IntervalItem** — недельные интервалы
2. **PeriodItem** — дневные/недельные периоды внутри интервалов
3. **DashItem** — элементы (задачи, работы, заявки), размещаемые в периодах

```
┌────────────────────────────────────────────────────────────────┐
│                     PeriodsStore                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IntervalItem (id=-4)                                   │   │
│  │  ┌──────────┐ ┌──────────┐       ┌──────────┐           │   │
│  │  │PeriodItem│ │PeriodItem│  ...  │PeriodItem│           │   │
│  │  │(day 1)   │ │(day 2)   │       │(day 7)   │           │   │
│  │  └────┬─────┘ └────┬─────┘       └────┬─────┘           │   │
│  │       │            │                  │                 │   │
│  │       ▼            ▼                  ▼                 │   │
│  │  [DashItem]    [DashItem]         [DashItem]            │   │
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
```

## TimeStore — источник истины о времени

**Назначение:** Хранит текущее время и вычисляет границы недель.

**Ключевые поля:**
- `today` — timestamp начала текущего дня (00:00 МСК)
- `monday0` — timestamp начала текущей недели (00:00 понедельника)
- `sunday0` — timestamp конца текущей недели (00:00 воскресенья)
- `weekMin`, `weekMax` — диапазон отображаемых недель (по умолчанию -4..+4)

**Методы:**
- `weekStart(id)` = `monday0 + weekLen * id`
- `weekEnd(id)` = `sunday0 + weekLen * id`
- `weeksRange()` — возвращает массив id недель [weekMin..weekMax+1] (bucket)

**Жизненный цикл:**
1. Создается при старте приложения
2. `updateTime()` вызывается каждую секунду
3. При смене дня пересчитываются `today`, `monday0`, `sunday0`

## PeriodsStore — контейнер интервалов

**Назначение:** Управляет коллекцией IntervalItem, реагирует на изменения времени.

**Ключевые поля:**
- `intervals` — Map(id → IntervalItem)
- `periods` — Map(start → PeriodItem) — все периоды всех интервалов

**Жизненный цикл:**

### Инициализация (constructor)
```javascript
constructor(main, layout, time) {
    this.weeksInit();  // Создает IntervalItem для всех недель
    
    // Подписки на изменения
    observe(time, 'weekMin', change => this.weeksInit());
    observe(time, 'weekMax', change => this.weeksInit());
    observe(time, 'today', change => this.weeksInit());
}
```

### weeksInit()
```javascript
weeksInit() {
    const weeks = this.time.weeksRange(true);  // [-4, -3, ..., 4, 5]
    
    // 1. Создаем или обновляем существующие интервалы
    weeks.forEach(id => {
        if (has(this.intervals, id)) {
            get(this.intervals, id).init();  // Обновляем существующий
        } else {
            set(this.intervals, id, new IntervalItem(id, ...));  // Создаем новый
        }
    });
    
    // 2. Удаляем интервалы, которых больше нет в диапазоне
    keys(this.intervals).forEach(id => {
        if (!weeks.includes(id)) {
            this.deleteInterval(id);
        }
    });
}
```

## IntervalItem — недельный интервал

**Назначение:** Группирует элементы по неделям, управляет периодами внутри недели.

**Ключевые поля:**
- `id` — номер недели относительно текущей (0 = текущая, -1 = прошлая, +1 = следующая)
- `start`, `end` — границы интервала в timestamp
- `today` — копия time.today на момент инициализации
- `periodsIds` — массив start-ов периодов этого интервала
- `itemsIds` — хранилище id элементов в этом интервале
- `expand` — кэш layout.expand

**Жизненный цикл:**

### Создание (constructor)
```javascript
constructor(id, main, time, items, layout, periods) {
    this.id = id;
    this.time = time;
    this.layout = layout;
    this.periods = periods;
    this.itemsIds = new ItemsIdsStore();
    
    this.init();  // Инициализация start/end и создание периодов
    
    // Подписка на изменение expand
    observe(layout, 'expand', () => {
        if (this.layout.expand !== this.expand) {
            this.reinitPeriods();
        }
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
        // Границы изменились
        this.start = start;
        this.end = end;
        this.today = today;
        
        this.reinitPeriods();  // Пересоздаем периоды
        
        // Перераспределяем элементы этого интервала
        if (oldEnd === null && end !== null) {
            this.reintervalItems([this.id + 1]);
        } else {
            this.reintervalItems();
        }
    }
}
```

### reinitPeriods() — пересоздание периодов
```javascript
reinitPeriods() {
    this.expand = this.layout.expand;
    const len = this.layout.expand ? TimeHelper.dayLen : TimeHelper.weekLen;
    
    // Удаляем старые периоды
    this.periodsIds.forEach(t => this.periods.deletePeriod(t));
    this.periodsIds = [];
    
    // Создаем новые периоды
    if (this.end === null) {
        // Bucket — один период без конца
        let period = new PeriodItem(this.start, null, this);
        this.periods.setPeriod(period);
        this.periodsIds.push(this.start);
    } else {
        // Обычный интервал — периоды по дням или неделе
        for (let t = this.start; t < this.end; t += len) {
            let period = new PeriodItem(t, len, this);
            this.periods.setPeriod(period);
            this.periodsIds.push(t);
        }
    }
    
    // Перераспределяем элементы по новым периодам
    this.reperiodItems();
}
```

### reintervalItems() — перераспределение элементов по интервалам
```javascript
reintervalItems(search = null) {
    // Берем все элементы этого интервала
    this.itemsTypes.forEach(type => {
        const ids = [...get(this.itemsIds.ids, type)];
        ids.forEach(i => {
            // Каждый элемент ищет себе новый интервал
            get(this.items[type].items, i).findInterval(search);
        });
    });
}
```

### filterItem(item) — проверка попадания элемента
```javascript
filterItem(item) {
    if (this.emeregency) return false;
    return (
        // Элемент с датой попадает в интервал
        (item.t !== null && item.t >= this.start && (
            (this.end !== null && item.t < this.end) ||
            this.end === null  // bucket принимает любые даты
        ))
        ||
        // Элемент без даты попадает только в bucket
        (item.t === null && this.end === null)
    );
}
```

## PeriodItem — период внутри интервала

**Назначение:** Отображает временной период (день или неделю) и содержит элементы.

**Ключевые поля:**
- `start` — начало периода
- `len` — длина периода (dayLen, weekLen или null для bucket)
- `end` = start + len (или null)
- `type` — 'day' | 'week'
- `title` — текст для отображения
- `className` — CSS класс для раскраски
- `isOpen`, `isClosed`, `isToday` — флаги для стилизации
- `interval` — ссылка на родительский IntervalItem

**Жизненный цикл:**

### Создание (constructor)
```javascript
constructor(start, len, interval) {
    this.start = start;
    this.len = len;
    this.end = len === null ? null : start + len;
    this.interval = interval;
    this.time = interval.time;
    
    this.timeInit();  // Вычисляем title, className, isOpen/isClosed
    this.itemsIds = new ItemsIdsStore();
}
```

### timeInit() — вычисление отображаемых свойств
```javascript
timeInit() {
    if (this.len === null) {
        // Bucket
        this.type = 'week';
        this.title = 'Долгий ящик';
        this.dropTime = null;
    } else if (this.len <= TimeHelper.dayLen) {
        // День
        this.type = 'day';
        this.title = TimeHelper.strWeekDayDate(this.start);
        this.dropTime = this.start + TimeHelper.hourLen * 18;  // 18:00
    } else {
        // Неделя
        this.type = 'week';
        this.dropTime = this.start + TimeHelper.dayLen * 4 + TimeHelper.hourLen * 18;
        
        // Вычисляем относительное название
        if (this.start < this.time.monday0) {
            this.title = 'Пред. неделя' или 'X нед. назад';
        } else if (this.start > this.time.sunday0) {
            this.title = 'След. неделя' или 'Через X нед.';
        } else {
            this.title = 'Эта неделя';
        }
    }
    
    // CSS класс на основе удаленности от текущей недели
    this.className = 'period0';
    if (this.start < this.time.monday0) {
        let week = Math.floor((this.time.monday0 - this.start - 1) / TimeHelper.weekLen) + 1;
        this.className = 'period' + Math.min(week, 7);
    }
    if (this.start > this.time.sunday0 - 1) {
        let week = Math.floor((this.start - this.time.sunday0) / TimeHelper.weekLen) + 1;
        this.className = 'period' + Math.min(week, 7);
    }
    
    // Флаги открытости/закрытости
    this.isClosed = (this.start <= this.time.today);
    this.isOpen = (this.end > this.time.today || this.end === null);
    this.isToday = (this.isClosed && this.isOpen);
}
```

**Важно:** `timeInit()` вызывается только в constructor! При изменении `today` PeriodItem не обновляет свои свойства автоматически — он пересоздается через `IntervalItem.reinitPeriods()`.

## DashItem — элементы задач/работ/заявок

**Назначение:** Представляет бизнес-сущности (задачи, работы, заявки, планы).

**Ключевые поля для позиционирования:**
- `t` — timestamp, к которому элемент относится (deadline или closedDate)
- `intervalId` — id интервала, в котором находится элемент
- `periodId` — start периода, в котором находится элемент

**Жизненный цикл позиционирования:**

### 1. recalcTime() — вычисление t
```javascript
recalcTime() {
    if (this.closedDate) {
        // Закрытый элемент — позиционируем по дате закрытия
        this.t = this.closedDate;
        this.isClosed = true;
        this.isOpen = false;
    } else {
        // Открытый элемент — позиционируем по deadline
        // Если deadline в прошлом — позиционируем на today (эффект "съезжания")
        this.t = this.deadline ? Math.max(this.deadline, this.context.time.today) : null;
        this.isClosed = false;
        this.isOpen = true;
    }
    
    if (this.t !== oldT) {
        this.findInterval();  // Ищем новый интервал
    }
}
```

### 2. findInterval() — поиск интервала
```javascript
findInterval(ids = null) {
    if (ids === null) {
        // Ищем среди всех интервалов (обратный порядок — сначала bucket)
        ids = keys(this.context.periods.intervals).sort((a, b) => b - a);
    }
    
    ids.forEach(id => {
        if (found) return;
        const interval = get(this.context.periods.intervals, id);
        if (interval.filterItem(this)) {
            this.setInterval(id);  // Привязываемся к интервалу
            found = true;
        }
    });
}
```

### 3. setInterval() — привязка к интервалу
```javascript
setInterval(id) {
    const interval = get(this.context.periods.intervals, id);
    
    if (this.intervalId !== id) {
        this.unsetInterval();  // Отцепляемся от старого
        this.intervalId = id;
        interval.attachItem(this);  // Прицепляемся к новому
    }
    
    // Ищем период внутри интервала
    this.findPeriod(interval.periodsIds);
}
```

### 4. findPeriod() — поиск периода внутри интервала
```javascript
findPeriod(ids = null) {
    if (ids === null) {
        ids = keys(this.context.periods.periods);
    }
    
    ids.forEach(t => {
        const period = get(this.context.periods.periods, t);
        if (period.filterItem(this)) {
            this.setPeriod(t);
            return;
        }
    });
}
```

### 5. setPeriod() — привязка к периоду
```javascript
setPeriod(id) {
    this.unsetPeriod();  // Отцепляемся от старого
    
    if (id !== null) {
        this.periodId = id;
        get(this.context.periods.periods, this.periodId).attachItem(this);
    }
}
```

## Поток данных при смене today

```
1. time.overrideDate(newTimestamp)
   ↓
2. time.today = newTimestamp
   time.monday0 = пересчитано
   time.sunday0 = пересчитано
   ↓
3. observe(time, 'today') → PeriodsStore.weeksInit()
   ↓
4. Для каждого существующего IntervalItem:
   IntervalItem.init()
   ↓
5. IntervalItem вычисляет новые start/end
   Если start/end изменились:
   ↓
6. IntervalItem.reinitPeriods()
   - Удаляет старые PeriodItem
   - Создает новые PeriodItem с новыми start/end
   - Вызывает reperiodItems() — перераспределяет свои элементы по новым периодам
   ↓
7. IntervalItem.reintervalItems()
   - Для каждого элемента интервала вызывает item.findInterval()
   - Элемент ищет подходящий интервал среди всех
   - Если нашел — привязывается к нему
```

## Потенциальные проблемы

### 1. PeriodItem не обновляется при смене today

`PeriodItem.timeInit()` вызывается только в constructor. При смене `today`:
- PeriodItem пересоздаются через `reinitPeriods()`
- Но их свойства (`title`, `className`, `isOpen`, etc.) вычисляются на момент создания
- Если `today` меняется, а PeriodItem не пересоздаются — они показывают устаревшие данные

**Решение:** PeriodItem всегда пересоздаются при изменении `start`/`end` интервала.

### 2. Элементы могут "потеряться" при смене today

Если элемент был в интервале 0, а `today` сдвинулся так, что элемент теперь должен быть в интервале -1:
- `reintervalItems()` вызывается только для элементов текущего интервала
- Элемент остается привязанным к старому `intervalId`
- Но `filterItem()` уже не сработает для этого интервала

**Решение:** Нужно перераспределять ВСЕ элементы, а не только текущего интервала.

### 3. Порядок обновлений MobX (КРИТИЧНО!)

При изменении `today` в `overrideDate()` или `updateTime()`:

**Проблема:** Если `today` обновляется ДО `monday0`/`sunday0`, то `observe(time, 'today')` сработает, когда `monday0` еще содержит старое значение. Это приводит к некорректному пересчету границ интервалов.

**Решение:** Всегда обновлять `monday0` и `sunday0` ДО `today`:

```javascript
@action overrideDate(timestamp) {
    // Сначала вычисляем все значения
    let m0 = ...;  // новый monday0
    let s0 = ...;  // новый sunday0
    let d0 = ...;  // новый today

    // Обновляем monday0 и sunday0 ПЕРВЫМИ
    this.monday0 = m0;
    this.sunday0 = s0;

    // Вспомогательные поля
    this.day = d;
    this.month = M;
    this.year = Y;
    this.wday = w;

    // today обновляем ПОСЛЕДНИМ (на него подписан PeriodsStore)
    this.today = d0;
}
```

**Почему это работает:**
- `observe(time, 'today')` срабатывает только при изменении `today`
- К этому моменту `monday0` и `sunday0` уже содержат актуальные значения
- `weeksInit()` читает корректные `monday0`/`sunday0` при вычислении границ интервалов

**Важно:** То же самое относится к `updateTime()` — `today` должен обновляться последним.

## Рекомендации по отладке

1. **Следить за порядком обновлений:**
```javascript
// В консоли
window.timeStore.overrideDate(new Date('2026-02-15').getTime());
// Смотреть логи в консоли — что обновляется первым
```

2. **Проверить состояние интервалов:**
```javascript
// В консоли
window.periodsStore.intervals.forEach((interval, id) => {
    console.log(`Interval ${id}: start=${interval.start}, end=${interval.end}`);
});
```

3. **Проверить привязку элементов:**
```javascript
// В консоли
const task = window.itemsStore.task.items.get(123);
console.log(`Task intervalId=${task.intervalId}, periodId=${task.periodId}, t=${task.t}`);
```
