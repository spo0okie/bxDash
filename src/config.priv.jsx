/**
 * Модуль-обёртка для доступа к конфигурации
 * 
 * Читает конфигурацию из window.__CONFIG__, 
 * который определяется в public/config.priv.js
 * 
 * Обеспечивает обратную совместимость с существующими импортами
 */

// Получаем конфигурацию из глобальной переменной
const config = window.__CONFIG__ || {};

// === URL сервисов ===
export const inventoryUrl = config.inventoryUrl || '';
export const apiUrl = config.apiUrl || '';
export const wsUrl = config.wsUrl || '';
export const asteriskUrl = config.asteriskUrl || '';
export const zabbixUrl = config.zabbixUrl || '';

// === Конфигурация тикетов Bitrix ===
export const ticketSiteId = config.ticketSiteId || 's1';
export const ticketCategoryId = config.ticketCategoryId || 43;
export const ticketSlaId = config.ticketSlaId || 1;

// === SLA / расписание ===
export const workScheduleId = config.workScheduleId || 0;
export const ticketSlaWorkDays = typeof config.ticketSlaWorkDays === 'number' ? config.ticketSlaWorkDays : 2;

// === Список пользователей ===
export const userList = config.userList || {};

// === Отладка ===
export const debugLogin = config.debugLogin || '';
export const debugPassword = config.debugPassword || '';
export const debugAutoLogin = config.debugAutoLogin || false;
export const showTimeDebugUI = config.showTimeDebugUI || false;
