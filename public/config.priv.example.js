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
	// Статический index.html: свой упорядоченный список скриптов Bitrix.
	// Без scripts используется прежний набор 2017 года; [] отключает загрузку.
	// При входе через index.php ресурсы задаются в portal.config.php.
	bitrixResources: {},
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
		callbackPollIntervalMs: 60000, // Периодичность опроса callback-заявок в ast22 (0 — выключить)
		callbackAfterIdleMs: 5000, // Перечитать заявки через N мс после ухода телефона в IDLE (0 — выкл)
		callbackAfterBusyMs: 3000, // Перечитать заявки через N мс после перехода телефона в INUSE (0 — выкл)
		sourceTimeOffset: "+00:00", // Пояс "голых" datetime от ast22 (прод отдаёт UTC)
		stubCallerNum: null,   // Заглушка: подставлять этот caller_num вместо запроса в ast22 (для отладки до готовности API)
		voiceBaseUrl: '',      // База URL сервиса отдачи записей (голосовое = <base>/<call_uuid>-voicemail.wav); пусто — Play отключён
	},

	// === SLA / расписание ===
	workScheduleId: 0,     // ID рабочего расписания в Inventory (0 = отключено)
	ticketSlaWorkDays: 2,  // SLA для тикетов в рабочих днях

	// === Дежурный техподдержки ===
	dutyScheduleId: 4,       // ID расписания техподдержки в ast22-phones (локальная таблица schedules, НЕ inventory_id; 0 = отключено)
	dutyPollIntervalMs: 60000, // Периодичность опроса дежурного через GET /api/v1/duty (мс)

	// === Список пользователей ===
	// Массив объектов с информацией о пользователях
	userList: [],
	
	// === Отладка ===
	debugLogin: '',        // Логин для автозаполнения при отладке
	debugPassword: '',     // Пароль для автозаполнения при отладке
	debugAutoLogin: false, // Автоматический вход при отладке
	showTimeDebugUI: false,// Показывать UI отладки времени
};
