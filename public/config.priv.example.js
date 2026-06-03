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
	asteriskUrl: '',       // URL ast22-phones (REST API телефонии, /api/v1/...)
	zabbixUrl: '',         // URL Zabbix API

	// === Панель входящих вызовов ===
	incomingCall: {
		enabled: true,         // Включить функцию входящих вызовов
		retryDelayMs: 500,     // Задержка между попытками получить звонок от ast22
		maxRetries: 10,        // Максимум попыток (с retryDelayMs=500 это ~5 секунд)
		panelHeightVh: 50,     // Высота развёрнутой карточки (vh)
		iframeZoom: 1,         // Масштаб содержимого карточки в iframe (например 0.8 = 80%)
		stubCallerNum: null,   // Заглушка: подставлять этот caller_num вместо запроса в ast22 (для отладки до готовности API)
	},

	// === SLA / расписание ===
	workScheduleId: 0,     // ID рабочего расписания в Inventory (0 = отключено)
	ticketSlaWorkDays: 2,  // SLA для тикетов в рабочих днях

	// === Список пользователей ===
	// Массив объектов с информацией о пользователях
	userList: [],
	
	// === Отладка ===
	debugLogin: '',        // Логин для автозаполнения при отладке
	debugPassword: '',     // Пароль для автозаполнения при отладке
	debugAutoLogin: false, // Автоматический вход при отладке
	showTimeDebugUI: false,// Показывать UI отладки времени
};
