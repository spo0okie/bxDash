// Тест для проверки работы MockDataHandler
import MockDataHandler from '../Helpers/MockDataHandler';

describe('MockDataHandler', () => {
  test('должен загружать mock данные для tasks', async () => {
    const tasks = await MockDataHandler.loadMockData('tasks');
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('должен загружать mock данные для zabbix', async () => {
    const zabbixData = await MockDataHandler.loadMockData('zabbix');
    expect(zabbixData).toBeDefined();
  });

  test('должен инициализировать все mock системы', async () => {
    const allData = await MockDataHandler.initMockSystems();
    expect(allData).toHaveProperty('tasks');
    expect(allData).toHaveProperty('zabbix');
    expect(allData).toHaveProperty('jobs');
  });
});