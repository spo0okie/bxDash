# AGENTS.md - Руководство по разработке для bxDash

Этот документ предоставляет всесторонние рекомендации для агентов-ассистентов по кодированию, работающих над приложением bxDash на базе React. Следуйте этим рекомендациям для поддержания качества и согласованности кода.

## Обзор проекта

bxDash - это dashboard-приложение на базе React, созданное с использованием:
- React 18 with hooks
- MobX для управления состояниями
- Ant Design для UI компонент
- Drag-and-drop функционал от Atlassian Pragmatic Drag and Drop
- WebSocket integration for real-time updates

## Команды сборки, линтинга и тестирования

### Сервер разработки
```bash
npm start
```
Запускает сервер разработки на http://localhost:3000 с горячей перезагрузкой.

### Продакшн-сборка
```bash
npm run build
```
Создает оптимизированную продакшн-сборку в директории `build/`.

### Тестирование

Для получения подробной информации о системе тестирования, запуске тестов и рекомендациях по написанию тестов обратитесь к [tests.md](tests.md).

### Линтинг и проверка типов

Проект использует стандартную конфигурацию ESLint от Create React App. Пользовательские скрипты линтинга не настроены.

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
- Используйте декораторы `@observable` и `@action` в классах хранилищ

### Управление состоянием

#### Структура хранилища
```javascript
import { observable, action, makeAutoObservable } from 'mobx';

class MainStore {
  @observable itemsTypes = ['task', 'ticket', 'job', 'plan', 'memo','absent'];

  constructor() {
    makeAutoObservable(this);
  }

  @action setInventoryUrl(url) {
    this.inventory.setUrl(url);
  }
}
```

#### Использование контекста
```javascript
import { useContext } from "react";
import { StoreContext } from "Data/Stores/StoreProvider";

const MyComponent = () => {
  const context = useContext(StoreContext);
  const { layout, main } = context;

  // Используйте хранилища здесь
};
```

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
│   ├── Layout/         # Компоненты layout
│   └── Items/          # Компоненты элементов
├── Data/               # Уровень данных
│   ├── Stores/         # MobX хранилища элементов
│   └── Items/          # Модели данных элементов
├── Helpers/            # Вспомогательные функции
└── config.priv.js      # Конфигурация
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

*Этот документ должен обновляться по мере развития кодовой базы. Последнее обновление: январь 2026*