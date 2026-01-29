// Система работы с mock данными для внешних систем
class MockDataHandler {
  // Загрузка mock данных для внешней системы
  static async loadMockData(systemName) {
    try {
      // В браузерной среде используем fetch, в Node.js - fs
      if (typeof window !== 'undefined') {
        const response = await fetch(`/mocks/${systemName}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load mock data for ${systemName}`);
        }
        return await response.json();
      } else {
        // Для серверного тестирования
        const fs = require('fs');
        const path = require('path');
        const mockPath = path.join(__dirname, `../mocks/${systemName}.json`);
        if (fs.existsSync(mockPath)) {
          const data = fs.readFileSync(mockPath, 'utf8');
          return JSON.parse(data);
        }
        return {};
      }
    } catch (error) {
      console.warn(`Mock data for ${systemName} not found:`, error.message);
      return {};
    }
  }
  
  // Проверка наличия mock файлов
  static hasMockFiles() {
    if (typeof window !== 'undefined') {
      // В браузерной среде проверяем через fetch
      return fetch('/mocks/tasks.json')
        .then(response => response.ok)
        .catch(() => false);
    } else {
      // В Node.js проверяем через fs
      const fs = require('fs');
      return fs.existsSync('./mocks/tasks.json');
    }
  }
  
  // Инициализация mock данных для всех систем
  static async initMockSystems() {
    const systems = ['tasks', 'jobs', 'plans', 'tickets', 'memos', 'absents', 'zabbix'];
    const mockData = {};
    
    for (const system of systems) {
      try {
        mockData[system] = await this.loadMockData(system);
      } catch (error) {
        console.warn(`Failed to load mock data for ${system}:`, error);
        mockData[system] = {};
      }
    }
    
    return mockData;
  }
}

// Функция для переключения между реальными и mock данными
export function getApiHandler(useMocks = false) {
  if (useMocks) {
    return {
      // Используем mock данные
      fetch: async (url, options = {}) => {
        // Определяем систему по URL
        if (url.includes('bitrix') || url.includes('tasks')) {
          const data = await MockDataHandler.loadMockData('tasks');
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve(data)
          };
        } else if (url.includes('zabbix')) {
          const data = await MockDataHandler.loadMockData('zabbix');
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve(data)
          };
        } else if (url.includes('jobs')) {
          const data = await MockDataHandler.loadMockData('jobs');
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve(data)
          };
        }
        // По умолчанию возвращаем пустой ответ
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({})
        };
      }
    };
  }
  
  // Возвращаем реальный fetch
  return { fetch };
}

export default MockDataHandler;