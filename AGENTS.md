# AGENTS.md - Руководство по разработке для bxDash

Этот документ предоставляет всесторонние рекомендации для агентов-ассистентов по кодированию, работающих над приложением bxDash на базе React. Следуйте этим рекомендациям для поддержания качества и согласованности кода.

## Обзор проекта

-bxDash - это dashboard-приложение на базе React, созданное с использованием:
- React 18 with hooks
- Vite для сборки и разработки
- MobX для управления состояниями
- Ant Design для UI компонент
- Drag-and-drop функционал от Atlassian Pragmatic Drag and Drop
- WebSocket integration for real-time updates

Папка `back/` содержит Bitrix-бэкенд сервиса, поэтому частоту правок нужно синхронизировать с владельцами backend-части.

## Команды сборки, линтинга и тестирования

### Сервер разработки
```cmd
npm start
# или
npm run dev
```
Запускает сервер разработки Vite на https://portal.azimuth.holding.local:3030/ с горячей перезагрузкой (HMR).

При необходимости остановить сервер (например для дальнейшего перезапуска)
```cmd
./stop.cmd
```

### Продакшн-сборка
```cmd
npm run build
```
Создает оптимизированную продакшн-сборку в директории `build/`.

### Тестирование

Для получения подробной информации о системе тестирования, запуске тестов и рекомендациях по написанию тестов обратитесь к [tests.md](tests.md).

### Preview (просмотр production сборки)
```cmd
npm run preview
```
Запускает локальный сервер для просмотра production сборки.

### Линтинг и проверка типов

Проект использует ESLint. Пользовательские скрипты линтинга не настроены.

## Рекомендации по стилю кода

### Организация импортов

Группируйте импорты в следующем порядке:
1. React импорты
2. Сторонние библиотеки (MobX, Ant Design и т.д.)
3. Локальные компоненты и утилиты

```javascript
import React, { useContext } from "react";
import { observable, action } from 'mobx';
import { Button } from 'antd';
import { StoreContext } from "Data/Stores/StoreProvider";
import Layout from "Components/Layout/Layout";
```

### Соглашения по именованию

#### Компоненты
- Используйте PascalCase для имен компонентов
- Имена файлов должны соответствовать именам компонентов
- Пример: `Sidebar.js` экспортирует `Sidebar`

#### Переменные и функции
- Используйте camelCase для переменных, функций и методов
- Пример: `sidebarWidth`, `setSidebarWidth()`, `handleClick`

#### Константы
- Используйте UPPER_CASE с подчеркиваниями
- Пример: `STATUS`, `API_ENDPOINT`

#### Классы и хранилища
- Используйте PascalCase для имен классов
- Пример: `MainStore`, `BackendSystem`

#### Файлы и директории
- Используйте PascalCase для директорий компонентов
- Используйте camelCase для файлов утилит
- Пример: `Components/Layout/Sidebar/`, `Helpers/TimeHelper.js`

### Форматирование и отступы

- Используйте табы для отступов (не пробелы)
- Точка с запятой опциональна, но не согласована в кодовой базе
- Поддерживайте согласованные пробелы вокруг операторов и скобок
- Используйте одинарные кавычки для строк (кроме JSX, где используются двойные кавычки)

### Паттерны компонентов

#### Функциональные компоненты с hooks
```javascript
import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";

const Sidebar = observer((props) => {
  const [isResizing, setIsResizing] = useState(false);
  const context = useContext(StoreContext);

  // Логика компонента здесь

  return (
    <div className="sidebar">
      {props.children}
    </div>
  );
});

export default Sidebar;
```

#### Интеграция MobX
- Используйте `observer` из `mobx-react` для реактивных компонентов
- Доступ к хранилищам через `useContext(StoreContext)`
- Используйте `makeObservable` с явным объявлением в классах хранилищ

### Управление состоянием

#### Архитектурные принципы (после рефакторинга 2026-05)

Эти принципы важно соблюдать при добавлении новой функциональности — иначе мы откатимся к сложности, от которой ушли. См. подробности в [plans/simplify.md](plans/simplify.md).

1. **Реестр типов элементов**. Все циклы по типам строятся из [`src/Data/itemTypes.jsx`](src/Data/itemTypes.jsx) (`ITEM_TYPES`, `ITEM_TYPE_NAMES`, `classForType`). Не плодить литеральные списки `[task, ticket, job, plan, memo, absent]` в коде — одно место правды.
2. **Стораджи через фабрику**. Не создавать стораджи в module scope. Вызов `createStores()` ровно один раз из [`App.jsx`](src/App.jsx) через `useState(() => createStores())`. Доступ из компонентов — через хук `useStores()` из [`StoreProvider.jsx`](src/Data/Stores/StoreProvider.jsx) (или `useContext(StoreContext)` для классовых компонентов).
3. **Декларативный поток items↔periods**. У `DashItem` НЕТ методов `findInterval/setInterval/findPeriod/setPeriod` и нет полей `intervalId/periodId`. Период (`PeriodItem`) сам решает, какие элементы в него попадают, через computed-фильтрацию (`PeriodItem._pick`). Не возвращать двусторонние ссылки.
4. **Один индекс на Period**. Группировка элементов по userId делается ровно один раз в `PeriodItem.itemsByUser` (computed). UserCell-компоненты только читают свою долю, не делают повторной фильтрации по `userId`/`accomplices`.
5. **WS-обработчики из реестра**. Новый тип элемента → добавить запись в `ITEM_TYPES` (с `wsEvent`/`wsIdField`), и [`WsStore.buildHandlers`](src/Data/Stores/WsStore.jsx) автоматически пропишет обработчик `*Update`-события. Не дублировать `case 'fooUpdate':` в switch.
6. **LayoutStore.prefs**. Все персистируемые настройки (видимость типов, expand, sidebar width) живут в `prefs = observable.map()`. Авто-сохранение в куки через `observe(this.prefs)`. Для нового флага — добавить ключ в `PREF_DEFAULTS` и опциональный геттер-обёртку для старого API.

#### Структура хранилища
```javascript
import { observable, action, makeObservable, computed } from 'mobx';

class ExampleStore {
    // Свойства, которые НЕ должны быть observable
    cookies = null;
    baseUrl = '';
    
    // Свойства, которые должны быть observable
    isLoading = false;
    items = observable.map();
    selectedId = null;
    
    constructor() {
        makeObservable(this, {
            isLoading: observable,
            items: observable,
            selectedId: observable,
            setLoading: action,
            setItems: action,
            setSelectedId: action,
            count: computed,  // геттеры помечаются как computed
        });
    }
    
    setLoading(value) { this.isLoading = value; }
    setItems(items) { this.items = items; }
    setSelectedId(id) { this.selectedId = id; }
    
    get count() { return this.items.size; }
}
```

⚠️ **Запись в observable.map ВНЕ action бросает в strict-mode** — например, `this.prefs.set(key, value)` в конструкторе. Если нужна массовая инициализация observable.map — создавайте её через `observable.map(initialEntries)` целиком, а не через цикл `.set()`.

⚠️ **`observe(store, 'fieldName', cb)` требует, чтобы `fieldName` было объявлено в `makeObservable`** — включая computed-геттеры. Если поле не зарегистрировано, бросает «no observable property X found».

#### Правила MobX

1. **Использовать только `makeObservable`** с явным объявлением реактивных свойств
2. **Не использовать декораторы** `@observable`, `@action`, `@computed`
3. **Не использовать `makeAutoObservable`** — делает все свойства реактивными
4. **Явно указывать тип** каждого свойства: `observable`, `action`, `computed`
5. **Секретные данные** (password, token) не должны быть observable

##### Модификаторы для особых случаев:
- `observable.struct` — для объектов, где важно глубокое сравнение
- `observable.ref` — для хранения ссылок без глубокой реакции
- `action.bound` — для методов, которые передаются как колбэки

#### Использование контекста

Предпочтительный способ — хук `useStores()`:

```javascript
import { useStores } from "Data/Stores/StoreProvider";

const MyComponent = () => {
  const { layout, main } = useStores();
  // Используйте хранилища здесь
};
```

Хук бросит явную ошибку, если вызван вне `<StoreContext.Provider>`. Для legacy-кода и классовых компонентов остаётся доступным `useContext(StoreContext)` / `Class.contextType = StoreContext`.

### Обработка ошибок

#### Блоки try-catch
Используйте try-catch для асинхронных операций и внешних API-вызовов:
```javascript
try {
  const response = await fetch('/api/data');
  const data = await response.json();
} catch (error) {
  console.error('Не удалось получить данные:', error);
  // Обработайте ошибку соответствующим образом
}
```

#### Логирование ошибок
- Используйте `console.error()` для ошибок
- Используйте `console.log()` для отладочной информации
- Включайте описательные сообщения об ошибках

#### Обработка ошибок WebSocket
```javascript
this.socket.addEventListener("error", (error) => {
  console.error("WebSocket error:", error);
  // Обработайте логику переподключения
});
```

### Асинхронный код

#### Паттерн async/await
```javascript
async authenticate(user, password, onSuccess, onFail) {
  this.bx.setLoginCredentials(user, password);
  this.zabbix.setLoginCredentials(user, password);

  when(() => this.bx.authStatus !== 'Pending' && this.zabbix.authStatus !== 'Pending', () => {
    if (this.bx.authStatus === 'OK' && this.zabbix.authStatus === 'OK') {
      if (onSuccess) onSuccess();
    } else {
      if (onFail) onFail();
    }
  });
}
```

#### Обработка ошибок Promise
```javascript
fetchData()
  .then(data => {
    // Обработайте успех
  })
  .catch(error => {
    console.error(error);
  });
```

### Drag and Drop

#### Использование Pragmatic Drag and Drop
```javascript
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop';

const DraggableItem = ({ item }) => {
  return (
    <div ref={draggableRef}>
      {item.title}
    </div>
  );
};
```

Следуйте паттернам, установленным в `Helpers/DndHelper.js` для логики drag-and-drop.

### Интеграция API

#### Аутентификация
Фронтенд запрашивать учетные данные, затем они используются несколькими бэкендами для запроса данных во внешних системах
Системы бэкенда используют различные схемы аутентификации. Обратитесь к вспомогательным файлам:
- `Helpers/BxHelper.js` для аутентификации Bitrix
- `Helpers/ZabbixHelper.js` для аутентификации Zabbix
- `Helpers/InventoryHelper.js` для аутентификации Inventory

### Организация файлов

#### Структура директорий
```
src/
├── Components/          # React компоненты
│   ├── Layout/         # Layout-композиция (Layout, CalendarGrid, BucketIntervals,
│   │                   #   RightPaneBucket, Modals, useGlobalShortcuts, Sidebar/MemoCell)
│   └── Items/          # Компоненты элементов
├── Data/               # Уровень данных
│   ├── itemTypes.jsx   # Реестр типов элементов (единый источник правды)
│   ├── Stores/         # MobX хранилища
│   └── Models/         # Модели данных элементов (TaskItem, JobItem и др.)
├── Helpers/            # Вспомогательные функции
├── back/               # Bitrix backend сервис
└── config.priv.jsx     # Конфигурация
```

#### Структура файлов компонентов
Каждый компонент должен быть в своей собственной директории с:
- `ComponentName.js` - Основной компонент
- `ComponentName.css` - Стили компонента (если нужно)
- `index.js` - Barrel экспорт (опционально)

### Соображения производительности

#### Оптимизация React
- Используйте `React.memo()` для дорогих компонентов
- Используйте `useCallback()` и `useMemo()` для дорогих вычислений
- Избегайте ненужных перерисовок с правильными массивами зависимостей

#### Оптимизация MobX
- Используйте вычисляемые значения для производных состояний
- Используйте реакции экономно
- Профилируйте производительность с MobX DevTools

### Рекомендации по тестированию

Подробное описание системы тестирования, текущих тестов и рекомендаций по расширению доступно в [tests.md](tests.md).

### Лучшие практики безопасности

#### Управление секретами

- Никогда не коммитьте API ключи, пароли или токены в систему контроля версий
- Используйте переменные окружения для чувствительной конфигурации
- Храните секреты в защищенных конфигурационных файлах (не включены в репозиторий)

#### Валидация ввода

- Валидируйте все пользовательские вводы на клиенте и сервере
- Санитизируйте данные перед рендерингом для предотвращения XSS
- Используйте HTTPS для всех внешних коммуникаций

### Интернационализация

#### Поддержка языков

Приложение поддерживает смешанный английский/русский контент:
- UI текст: В основном русский
- Комментарии в коде: русский
- Технические термины: Английский

Поддерживайте согласованность с существующим использованием языка в комментариях и UI тексте.

#### Общение с ИИ-ассистентами

ИИ-ассистенты должны общаться на русском языке при работе над проектом bxDash, включая объяснения кода, планы задач и пользовательские инструкции.

### Рабочий процесс Git

#### Сообщения коммитов

Следуйте формату conventional commits:
```
feat: добавить новую функцию dashboard
fix: разрешить проблему drag-and-drop
docs: обновить README
```

#### Ветвление

- Используйте feature-ветки для новой разработки
- Используйте описательные названия веток: `feature/drag-drop-improvements`

### Среда разработки

#### Необходимые инструменты
- Node.js (версия указана в package.json)
- npm для управления пакетами
- Git для контроля версий

#### Конфигурация IDE
- Настройте TypeScript language server
- Включите интеграцию ESLint
- Установите размер таба в соответствии с отступами проекта


---

*Этот документ должен обновляться по мере развития кодовой базы. Последнее обновление: май 2026 (после рефакторинга simplify, см. [plans/simplify.md](plans/simplify.md)).*
