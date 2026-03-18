# Рейтинг неудачных решений проекта bxDash
## (от наиболее очевидных к наименее очевидным)

---

## 🔴 ВЫСОКАЯ ОЧЕВИДНОСТЬ


### 5. Экспорт stores в window для отладки
**Критичность:** 🟡 Средняя | **Файл:** [`StoreProvider.jsx`](src/Data/Stores/StoreProvider.jsx:54-62)

Потенциальная проблема безопасности в production, загрязнение глобальной области.
```javascript
window.timeStore = timeStore;
window.layoutStore = layoutStore;
```

---

### 6. Побочные эффекты при импорте StoreProvider
**Критичность:** 🔴 Высокая | **Файл:** [`StoreProvider.jsx`](src/Data/Stores/StoreProvider.jsx:15-39)

Инициализация всех stores на уровне модуля. Невозможно тестировать изолированно, нет ленивой загрузки.

---

### 9. Прямое обращение к DOM из Store
**Критичность:** 🟡 Средняя | **Файл:** [`LayoutStore.jsx`](src/Data/Stores/LayoutStore.jsx:39)

Store создаёт DOM-элементы для измерения scrollbar. Нарушает тестируемость и SSR.

---

## 🟡 СРЕДНЯЯ ОЧЕВИДНОСТЬ

### 10. God Object: DashItem (600 строк)
**Критичность:** 🔴 Высокая | **Файл:** [`DashItem.jsx`](src/Data/Items/DashItem.jsx)

Нарушает SRP: хранение данных, UI-состояние, бизнес-логика, сетевые операции, drag-and-drop — всё в одном классе.

---

### 11. Мутация аргументов функций
**Критичность:** 🔴 Высокая | **Файлы:** DndHelper.jsx, IntervalHelper.jsx, ArrayHelper.jsx

Функции мутируют переданные массивы вместо возврата новых.
```javascript
list.splice(0,1);  // Мутация аргумента!
array.push(item);  // Мутация аргумента!
```

---

### 12. Циклические зависимости между Stores
**Критичность:** 🔴 Высокая | **Файлы:** StoreProvider.jsx, WsStore.jsx, ItemsStore.jsx

WsStore ↔ ItemsStore ↔ PeriodsStore образуют циклические связи.

---

### 13. Memory leaks: отсутствие dispose для intervals/reactions
**Критичность:** 🔴 Высокая | **Файлы:** BackendSystem.jsx, UserItem.jsx, PeriodsStore.jsx

Интервалы и реакции никогда не очищаются.
```javascript
setInterval(() => { this.recalcTime(); }, 5*1000);  // Никогда не очищается!
```

---

### 14. useEffect с неполными/некорректными зависимостями
**Критичность:** 🔴 Высокая | **Файлы:** CreateTicketModal.jsx, UserItem.jsx

Массивы зависимостей не включают все используемые значения → stale closures.

---

### 15. UI-логика в Stores
**Критичность:** 🟡 Средняя | **Файл:** [`ItemsMultiStore.jsx`](src/Data/Stores/Items/ItemsMultiStore.jsx:122)

Store содержит `contextMenu` — ответственность компонентов.

---

### 16. Magic numbers без констант
**Критичность:** 🟡 Средняя | **Файлы:** TimeHelper.jsx, IntervalHelper.jsx, SortHelper.jsx, CreateItemButton.jsx

```javascript
tzOffest=3*3600*1000;  // Что это?
if (item.type === 'plan') return 120;  // Почему 120?
id: items.getMaxId() + 64,  // Почему 64?
```

---

### 17. Дублирование кода
**Критичность:** 🟡 Средняя

- Auth helpers: BxHelper, ZabbixHelper, InventoryHelper — идентичный паттерн
- CreateItemButton: 5 компонентов с 70% дублированием
- DndHelper: `dashItemDropOnItem` и `dashItemDropOnCell` на 70% идентичны

---

### 18. Неправильное использование observe()
**Критичность:** 🟡 Средняя | **Файл:** [`PeriodsStore.jsx`](src/Data/Stores/Periods/PeriodsStore.jsx:106)

`observe` не возвращает disposer, невозможно отписаться. Лучше использовать `reaction()`.

---


## 🟢 НИЗКАЯ ОЧЕВИДНОСТЬ

### 20. Отсутствие слоя сервисов
**Критичность:** 🔴 Высокая

Бизнес-логика смешана с stores. Сетевые вызовы разбросаны по ItemsStore, DashItem, BackendSystem.


### 22. Hardcoded timezone (Europe/Moscow)
**Критичность:** 🟡 Средняя | **Файл:** [`TimeHelper.jsx`](src/Helpers/TimeHelper.jsx:5-8)

Нет возможности конфигурации под другие часовые пояса.

---

### 23. Deep observable maps
**Критичность:** 🟡 Средняя | **Файл:** [`ItemsStore.jsx`](src/Data/Stores/Items/ItemsStore.jsx:13)

`deep: true` вызывает избыточное отслеживание изменений.

---

### 24. Побочные эффекты в конструкторе WsStore
**Критичность:** 🟡 Средняя | **Файл:** [`WsStore.jsx`](src/Data/Stores/WsStore.jsx:170-183)

Конструктор вызывает `connect()` и устанавливает интервалы.

---

### 25. Прямое мутирование DOM в EditItem
**Критичность:** 🟡 Средняя | **Файл:** [`EditItem.jsx`](src/Components/Items/EditItem/EditItem.jsx:53-66)

Противоречит декларативному подходу React.

---

### 26. Отсутствие TypeScript
**Критичность:** 🟡 Средняя

Для сложной структуры stores отсутствие типизации создаёт риск ошибок.

---

### 27. Callbacks вместо Promise chains
**Критичность:** 🟡 Низкая | **Файл:** [`MainStore.jsx`](src/Data/Stores/MainStore.jsx:58)

Callback hell вместо современного async/await.

---

### 28. Singleton через присвоение при экспорте
**Критичность:** 🟢 Низкая | **Файлы:** TimeHelper.jsx, ArrayHelper.jsx

Усложняет тестирование.

---

### 29. Нарушение структуры директорий
**Критичность:** 🟢 Низкая | **Файл:** MemoCell.jsx

[`MemoCell`](src/Components/MemoCell/MemoCell.jsx) находится в `Components/MemoCell/` вместо `Components/Items/MemoCell/`.

---

### 30. Опечатки и непоследовательное именование
**Критичность:** 🟢 Низкая

- `emeregency` вместо `emergency` в IntervalItem.jsx
- `not founf` вместо `not found` в ArrayHelper.jsx

---

## Сводная статистика

| Категория | Высокая очевидность | Средняя очевидность | Низкая очевидность |
|-----------|---------------------|---------------------|---------------------|
| 🔴 Высокая критичность | 2 | 5 | 2 |
| 🟡 Средняя критичность | 6 | 10 | 4 |
| 🟢 Низкая критичность | 1 | 0 | 0 |

---

## Приоритет исправлений

1. **Немедленно:** Безопасность паролей (#1), убрать console.log (#2)
2. **Высокий:** Memory leaks (#13), циклические зависимости (#12), God Object DashItem (#10)
3. **Средний:** Рефакторинг MobX стилей (#3), добавить @computed (#8), исправить useEffect (#14)
4. **Низкий:** Документация, типизация, стилистические правки

---

*Анализ выполнен: 2026-02-21*
