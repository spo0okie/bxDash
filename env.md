# Локальные настройки окружения

Этот файл содержит реальные URL и настройки для текущего окружения.
**Не коммитьте этот файл в git!**

## URL для разработки

```javascript
// Примеры URL для локальной разработки:
// Замените на реальные адреса вашего окружения

export const inventoryUrl = 'https://inventory.company.local/web/';
export const apiUrl = 'https://portal.company.local/app/api/';
export const wsUrl = 'wss://inventory.company.local:2346/dash';
export const asteriskUrl = 'https://pbx.company.local:44382';
export const zabbixUrl = 'https://zabbix.company.local/';
```

## Настройки для VS Code launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "React: Chrome",
      "type": "pwa-chrome",
      "request": "launch",
      "url": "https://portal.company.local/app/",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

## Настройки для Playwright

```javascript
// playwright.config.js
export default defineConfig({
  use: {
    baseURL: 'https://portal.company.local/app/',
    // ... другие настройки
  },
});
```

## Инструкция

1. Скопируйте содержимое этого файла в ваш локальный конфиг
2. Замените `company.local` на реальные домены вашего окружения
3. Не добавляйте этот файл в git (уже в .gitignore)
