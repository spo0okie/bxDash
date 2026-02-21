/**
 * Пример файла конфигурации bxDash
 * 
 * Инструкция:
 * 1. Скопируйте этот файл в config.priv.js
 * 2. Заполните все необходимые поля своими данными
 * 
 * ВНИМАНИЕ: config.priv.js не должен быть в репозитории!
 */

window.__CONFIG__ = {
	// === URL сервисов ===
	inventoryUrl: '',      // URL Inventory API
	apiUrl: '',            // URL Bitrix API
	wsUrl: '',             // URL WebSocket (wss://...)
	asteriskUrl: '',       // URL Asterisk
	zabbixUrl: '',         // URL Zabbix API
	
	// === Список пользователей ===
	// Массив объектов с информацией о пользователях
	userList: [],
	
	// === Отладка ===
	debugLogin: '',        // Логин для автозаполнения при отладке
	debugPassword: '',     // Пароль для автозаполнения при отладке
	debugAutoLogin: false, // Автоматический вход при отладке
	showTimeDebugUI: false,// Показывать UI отладки времени
};
