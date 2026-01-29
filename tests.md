# Описание тестирования в bxDash

Этот документ описывает систему тестирования приложения bxDash, включая текущие тесты, рекомендации по запуску и расширению. Также описаны новые системы E2E тестирования и mock данных для внешних систем.

## Обзор системы тестирования

bxDash использует:
- **Jest** как тестовый фреймворк
- **@testing-library/react** для тестирования компонентов React
- **@testing-library/jest-dom** для дополнительных матчеров DOM
- **Playwright** для E2E тестирования
- **TypeScript** для типизации тестов

## Запуск тестов

### Основные команды
```bash
# Запуск всех тестов в режиме слежения с интерактивными опциями
npm test

# Запуск всех тестов один раз без watch mode
npm test -- --watchAll=false

# Запуск тестов в CI-режиме с покрытием кода (подходит для CI/CD)
npm test -- --ci --coverage --watchAll=false

# Запуск конкретного тестового файла
npm test -- src/App.test.js

# Запуск тестов по шаблону названия
npm test -- --testNamePattern="renders learn react link"

# Запуск тестов с подробным выводом
npm test -- --verbose

# Запуск тестов с покрытием кода
npm test -- --coverage --watchAll=false

# Запуск unit тестов
npm run test:unit

# Запуск E2E тестов с Playwright
npm run test:e2e

# Запуск тестов с покрытием кода
npm run test:coverage

# Запуск тестов mock данных
npm run test:mock
```

### Конфигурация Babel
Тесты используют специальную конфигурацию Babel для поддержки MobX decorators и ESM модулей:
- `.babelrc` - основная конфигурация с loose mode для Babel плагинов
- `jest.config.js` - настройка Jest для работы с Vite проектом
- `setupTests.js` - глобальные mock и настройки

## Текущие тесты

### App.test.js
**Расположение:** `src/App.test.js`
**Описание:** Тест рендеринга главного компонента App
**Что тестирует:**
- Рендеринг приложения без ошибок
- Наличие текста "Режим планирования" в меню

```javascript
test('renders bxDash app', () => {
  render(<App />);
  const menuElement = screen.getByText(/Режим планирования/i);
  expect(menuElement).toBeInTheDocument();
});
```

### Helpers тесты

#### TimeHelper.test.ts
**Расположение:** `src/Helpers/TimeHelper.test.ts`
**Описание:** Тесты утилит работы со временем
**Что тестирует:**
- `getTime()` - возвращает объект Date
- `getTimestamp()` - возвращает число timestamp
- `zeroPad()` - добавление ведущего нуля
- `strDate()` - форматирование даты в YYYY-MM-DD
- `bitrixDateTimeToJs()` - парсинг даты Bitrix

#### ArrayHelper.test.ts
**Расположение:** `src/Helpers/ArrayHelper.test.ts`
**Описание:** Тесты утилит работы с массивами
**Что тестирует:**
- `addUniq()` - добавление уникальных элементов
- `delUidItem()` - удаление элементов по uid
- `moveItem()` - перемещение элементов в массиве

### Components тесты

#### Menu.test.js
**Расположение:** `src/Components/Layout/Header/Menu/Menu.test.js`
**Описание:** Тест компонента меню
**Что тестирует:**
- Рендеринг кнопки "Режим планирования"
- Использует mock MobX stores (time, layout)

```javascript
const mockStore = {
  time: { strTime: '10:00' },
  layout: { memosVisible: false },
  // ... other mocks
};

render(
  <StoreContext.Provider value={mockStore}>
    <Menu />
  </StoreContext.Provider>
);
```

### AuthForm тесты

#### InvAuthForm.test.js
**Расположение:** `src/Components/Layout/AuthForm/InvAuthForm.test.js`
**Описание:** Тест компонента формы авторизации
**Что тестирует:**
- Рендеринг формы авторизации
- Автозаполнение данных из config.priv.js
- Выполнение авторизации при включенном автовходе

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvAuthForm from '../src/Components/Layout/AuthForm/InvAuthForm';

// Mock для MobX store
const mockStore = {
  main: {
    authenticate: jest.fn()
  }
};

test('рендерит форму авторизации', () => {
  render(<InvAuthForm />);
  expect(screen.getByText('Авторизация')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Вход/i })).toBeInTheDocument();
});

test('заполняет форму данными из config.priv.js', async () => {
  render(<InvAuthForm />);
  
  // Проверяем автозаполнение
  await waitFor(() => {
    expect(screen.getByDisplayValue('reviakin.a')).toBeInTheDocument();
  });
});

test('выполняет авторизацию при включенном автовходе', async () => {
  render(<InvAuthForm />);
  
  // Ждем автозаполнения
  await waitFor(() => {
    expect(screen.getByDisplayValue('reviakin.a')).toBeInTheDocument();
  });
  
  // Проверяем что authenticate был вызван
  expect(mockStore.main.authenticate).toHaveBeenCalled();
});
```

## Новые системы тестирования

### Mock данные для внешних систем
**Расположение:** `src/Helpers/MockDataHandler.js`
**Описание:** Система для работы с mock данными внешних систем

#### Использование MockDataHandler:
```javascript
import MockDataHandler from '../Helpers/MockDataHandler';

// Загрузка mock данных для конкретной системы
const tasks = await MockDataHandler.loadMockData('tasks');
const zabbixData = await MockDataHandler.loadMockData('zabbix');

// Инициализация всех mock систем
const allData = await MockDataHandler.initMockSystems();
```

#### Структура mock файлов:
- `mocks/tasks.json` - задачи из Bitrix
- `mocks/jobs.json` - работы из Bitrix  
- `mocks/plans.json` - планы из Bitrix
- `mocks/tickets.json` - тикеты из Bitrix
- `mocks/memos.json` - заметки из Bitrix
- `mocks/absents.json` - отсутствия из Bitrix
- `mocks/zabbix.json` - данные из Zabbix

### E2E тестирование с Playwright
**Расположение:** `tests/`
**Описание:** End-to-end тесты с использованием Playwright

#### Пример E2E теста:
```javascript
import { test, expect } from '@playwright/test';

test('should login and display dashboard', async ({ page }) => {
  await page.goto('https://portal.azimuth.holding.local/reviakin/z2/');
  
  // Заполнение формы авторизации
  await page.fill('[name="login"]', 'testuser');
  await page.fill('[name="password"]', 'testpass');
  await page.click('button:has-text("Вход")');
  
  // Проверка успешного входа
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('text=Режим планирования')).toBeVisible();
});
```

## Покрытие кода

Текущие показатели покрытия (npm test -- --coverage):
- Statements: 32.38%
- Branches: 14.96%
- Functions: 24.23%
- Lines: 34.88%

### Наиболее покрытые модули
- `src/App.js` - 100%
- `src/Components/Layout/Header/AppHeader.js` - 100%
- `src/Helpers/ArrayHelper.ts` - 94.73%

### Модули с низким покрытием
- `src/Helpers/DndHelper.ts` - 0%
- `src/Components/Items/ItemCards/Memo/MemoCard.js` - 2.27%
- `src/Data/Stores/WsStore.js` - 31.08%

## Рекомендации по расширению тестов

### Добавление тестов компонентов
1. Создавайте тестовые файлы рядом с компонентами: `Component.test.js`
2. Mock внешние зависимости (MobX stores, API calls)
3. Тестируйте пользовательские взаимодействия через @testing-library/react
4. Используйте `StoreContext.Provider` для mock stores

Пример структуры теста компонента:
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import MyComponent from './MyComponent';

const mockStore = { /* mock data */ };

test('renders and handles interaction', () => {
  render(
    <StoreContext.Provider value={mockStore}>
      <MyComponent />
    </StoreContext.Provider>
  );

  // Assertions
  expect(screen.getByText('expected text')).toBeInTheDocument();

  // Interactions
  fireEvent.click(screen.getByRole('button'));
  expect(mockStore.someAction).toHaveBeenCalled();
});
```

### Добавление тестов helpers
1. Тестируйте публичные функции
2. Покрывайте edge cases и error handling
3. Используйте describe/it блоки для группировки

### Добавление тестов stores (MobX)
1. Тестируйте actions и computed values
2. Mock внешние зависимости (API, WebSocket)
3. Проверяйте изменения состояния

Пример:
```javascript
import MyStore from './MyStore';

test('action updates state', () => {
  const store = new MyStore();
  store.doAction('test');
  expect(store.someObservable).toBe('expected');
});
```

### Добавление интеграционных тестов
1. Тестируйте взаимодействия между компонентами
2. Mock API responses с axios-mock-adapter
3. Тестируйте WebSocket события

## Mock стратегии

### ESM модули
В `setupTests.js` добавлены mock для ESM модулей:
```javascript
jest.mock('remark-gfm', () => ({}));
jest.mock('react-markdown', () => ({ default: () => null }));
jest.mock('unist-util-visit', () => ({ visit: jest.fn() }));
```

### API mocks
Используйте axios-mock-adapter или jest.mock для API вызовов:
```javascript
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
mock.onGet('/api/data').reply(200, mockData);
```

### MobX stores
Mock через StoreContext.Provider с partial mock объектами.

## Интеграция с миграцией JS→TS

### Проверка типов
```bash
# Проверка TypeScript без генерации файлов
npx tsc --noEmit
```

### Обновление тестов при миграции
1. Измените расширения файлов: `.js` → `.ts`/`.tsx`
2. Обновите импорты в тестах
3. Добавьте type assertions где нужно
4. Запускайте полную тестовую suite после каждого шага

### Workflow миграции
1. **Базовая линия:** Установлены рабочие тесты перед миграцией
2. **Валидация шагов:** Запуск тестов после каждого файла
3. **Обработка ошибок:** Остановка при провале тестов
4. **Покрытие:** Поддержание >80% coverage

## Лучшие практики

- **Mock внешних зависимостей:** WebSocket, API, внешние системы
- **Соглашения по тестам:** Следовать паттернам @testing-library/react
- **Организация тестов:** Размещать рядом с компонентами или в __tests__
- **Документация:** Обновлять tests.md при добавлении новых тестов

## Troubleshooting

### Проблемы с Babel
Если возникают ошибки 'loose' mode:
- Проверьте `.babelrc` на consistent loose: true
- Убедитесь в правильной настройке `jest.config.js`

### Проблемы с ESM
- Добавьте mock в setupTests.js для новых ESM зависимостей
- Используйте transformIgnorePatterns в jest config

### Проблемы с MobX
- Mock stores через StoreContext.Provider
- Используйте observable объекты в mocks если нужно reactivity

---

*Этот документ должен обновляться при расширении системы тестирования*