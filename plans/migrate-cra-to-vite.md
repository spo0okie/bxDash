# План миграции с CRA на Vite

## Обзор проекта

bxDash - dashboard-приложение на React 18 с:
- **State management**: MobX с decorators (@observable, @action)
- **UI**: Ant Design
- **Drag-n-drop**: Atlassian Pragmatic Drag and Drop
- **Тестирование**: Jest (unit) + Playwright (E2E)
- **Сборка**: Create React App с react-app-rewired

## Почему Vite?

- Быстрый HMR (Hot Module Replacement)
- Мгновенный старт dev сервера
- Оптимизированная production сборка
- Современная альтернатива CRA

---

## Архитектура миграции

```mermaid
flowchart TB
    subgraph "Текущая CRA конфигурация"
        A[react-scripts] --> B[react-app-rewired]
        B --> C[config-overrides.js]
        C --> D[Babel plugins для decorators]
        A --> E[webpack]
    end

    subgraph "Новая Vite конфигурация"
        F[vite] --> G[@vitejs/plugin-react]
        G --> H[Babel config для decorators]
        F --> I[esbuild]
    end

    subgraph "Общие компоненты"
        J[src/index.js]
        K[public/index.html]
        L[Jest тесты]
        M[Playwright тесты]
    end

    A -.->|заменяется| F
    K -.->|перемещается| N[index.html в корне]
```

---

## Детальный план миграции

### Фаза 1: Подготовка

- [ ] Создать резервную копию проекта перед миграцией

### Фаза 2: Установка зависимостей

- [ ] Установить Vite и необходимые зависимости:

```bash
npm install --save-dev vite @vitejs/plugin-react
```

### Фаза 3: Конфигурация Vite

- [ ] Создать [`vite.config.js`](vite.config.js) с поддержкой MobX decorators:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Чтение SSL сертификатов
const httpsConfig = {
  cert: fs.readFileSync('./dev/cert.cer'),
  key: fs.readFileSync('./dev/cert.key'),
};

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
          ['@babel/plugin-proposal-private-methods', { loose: true }],
          ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      Components: path.resolve(__dirname, './src/Components'),
      Data: path.resolve(__dirname, './src/Data'),
      Helpers: path.resolve(__dirname, './src/Helpers'),
      config: path.resolve(__dirname, './src/config'),
    },
  },
  server: {
    port: 3030,
    https: httpsConfig,
    host: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  publicDir: 'public',
});
```

- [ ] Настроить алиасы путей (Components, Data, Helpers, config)
- [ ] Настроить HTTPS сервер с SSL сертификатами (порт 3030)

### Фаза 4: Миграция HTML

- [ ] Переместить [`index.html`](index.html) из `public/` в корень проекта
- [ ] Обновить [`index.html`](index.html):
  - Заменить `%PUBLIC_URL%` на относительные пути
  - Добавить `<script type="module" src="/src/index.js"></script>`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="bxDash Dashboard" />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>bxDash</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>
```

### Фаза 5: Обновление package.json

- [ ] Обновить [`package.json`](package.json):

```json
{
  "scripts": {
    "start": "vite --port 3030",
    "dev": "vite --port 3030",
    "build": "vite build",
    "preview": "vite preview --port 3030",
    "test": "react-app-rewired test",
    "test:unit": "jest",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:mock": "jest --testPathPattern=__tests__"
  }
}
```

- [ ] Удалить CRA зависимости:
  - `react-scripts`
  - `react-app-rewired`
  - `customize-cra`

### Фаза 6: Обновление тестовой конфигурации

- [ ] Обновить [`jest.config.js`](jest.config.js) для работы без CRA:

```javascript
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^Components/(.*)$': '<rootDir>/src/Components/$1',
    '^Data/(.*)$': '<rootDir>/src/Data/$1',
    '^Helpers/(.*)$': '<rootDir>/src/Helpers/$1',
    '^config$': '<rootDir>/src/config.priv.js',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/config.priv.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(antd|@atlaskit)/)'
  ],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
```

- [ ] Обновить [`playwright.config.js`](playwright.config.js):

```javascript
webServer: {
  command: 'npm run dev',
  url: 'https://localhost:3030',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

### Фаза 7: Обновление вспомогательных файлов

- [ ] Обновить [`start.cmd`](start.cmd):

```cmd
npm run dev
```

- [ ] Обновить [`jsconfig.json`](jsconfig.json) или заменить на `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": "src",
    "experimentalDecorators": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### Фаза 8: Удаление CRA файлов

- [ ] Удалить CRA-специфичные файлы:
  - [`config-overrides.js`](config-overrides.js)
  - [`.babelrc`](.babelrc) (оставить для Jest если нужно)

### Фаза 9: Тестирование

- [ ] Тестирование: проверить dev сервер (`npm run dev`)
- [ ] Тестирование: проверить production сборку (`npm run build`)
- [ ] Тестирование: проверить работу unit тестов (`npm run test:unit`)
- [ ] Тестирование: проверить работу E2E тестов (`npm run test:e2e`)
- [ ] Тестирование: проверить HTTPS соединение

### Фаза 10: Обновление документации

- [ ] Обновить [`README.md`](README.md):
  - Убрать упоминания CRA
  - Обновить команды запуска
- [ ] Обновить [`AGENTS.md`](AGENTS.md):
  - Обновить команды сборки
- [ ] Обновить [`tests.md`](tests.md):
  - Обновить информацию о тестировании

---

## Проверочный чеклист

### Функциональность
- [ ] Приложение запускается в dev режиме
- [ ] HMR работает корректно
- [ ] Production сборка создается без ошибок
- [ ] Все импорты CSS работают
- [ ] Все алиасы путей работают
- [ ] MobX decorators работают
- [ ] HTTPS сервер работает

### Тесты
- [ ] Jest unit тесты проходят
- [ ] Playwright E2E тесты проходят
- [ ] Покрытие кода собирается

### Интеграции
- [ ] WebSocket соединение работает
- [ ] Bitrix API интеграция работает
- [ ] Zabbix API интеграция работает
- [ ] Inventory API интеграция работает

---

## Возможные проблемы и решения

### Проблема: Decorators не работают
**Решение**: Убедиться что в vite.config.js правильно настроен babel плагин

### Проблема: Алиасы путей не работают
**Решение**: Проверить resolve.alias в vite.config.js и moduleNameMapping в jest.config.js

### Проблема: HTTPS сертификаты не загружаются
**Решение**: Проверить пути к сертификатам в vite.config.js

### Проблема: Jest не находит модули
**Решение**: Обновить moduleNameMapping в jest.config.js

### Проблема: CSS импорты не работают
**Решение**: Vite поддерживает CSS импорты из коробки, проверить пути

---

## Ссылки

- [Vite документация](https://vitejs.dev/guide/)
- [Vite React плагин](https://github.com/vitejs/vite-plugin-react)
- [Миграция с CRA на Vite](https://vitejs.dev/guide/backend-integration.html)
