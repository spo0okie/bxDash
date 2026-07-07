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
export const inventoryUrl = config.inventoryUrl || "";
export const apiUrl = config.apiUrl || "";
export const wsUrl = config.wsUrl || "";
export const asteriskUrl = config.asteriskUrl || "";
export const zabbixUrl = config.zabbixUrl || "";

// === Панель входящих вызовов ===
const ic = config.incomingCall || {};
export const incomingCallConfig = {
	enabled: ic.enabled !== false,
	retryDelayMs: typeof ic.retryDelayMs === "number" ? ic.retryDelayMs : 500,
	maxRetries: typeof ic.maxRetries === "number" ? ic.maxRetries : 10,
	panelHeightVh: typeof ic.panelHeightVh === "number" ? ic.panelHeightVh : 50,
	iframeZoom: typeof ic.iframeZoom === "number" ? ic.iframeZoom : 1,
	// Периодичность опроса callback-заявок в ast22 (мс). 0 — выключить опрос.
	callbackPollIntervalMs:
		typeof ic.callbackPollIntervalMs === "number"
			? ic.callbackPollIntervalMs
			: 60000,
	// Через сколько мс после ухода своего телефона в IDLE перечитать заявки
	// (по только что завершённому звонку мог сформироваться callback). 0 — выкл.
	callbackAfterIdleMs:
		typeof ic.callbackAfterIdleMs === "number" ? ic.callbackAfterIdleMs : 25000,
	// Через сколько мс после перехода своего телефона в INUSE перечитать заявки
	// (callback мог сформироваться ещё во время проигрывания сообщения). 0 — выкл.
	callbackAfterBusyMs:
		typeof ic.callbackAfterBusyMs === "number" ? ic.callbackAfterBusyMs : 5000,
	// Пояс, в котором ast22 отдаёт "голые" datetime без TZ-метки (created_at/started_at).
	// Прод-Postgres отдаёт UTC, поэтому дефолт "+00:00". TimeHelper затем переводит
	// в выбранный пояс отображения (МСК/локальный). Если в строке есть TZ-маркер
	// (Z/±HH:MM) — это значение игнорируется.
	sourceTimeOffset:
		typeof ic.sourceTimeOffset === "string" ? ic.sourceTimeOffset : "+00:00",
	// Заглушка: пока ast22 API не готов, при ringing сразу подставляем этот caller_num,
	// минуя реальный запрос звонка. Убрать (== null) когда телефония заработает.
	stubCallerNum: ic.stubCallerNum ?? null,
	// База URL сервиса отдачи записей (http/elma365.php в ast22-phones):
	// голосовое = <voiceBaseUrl>/<call_uuid>-voicemail.wav. Пусто — кнопка
	// Play остаётся заглушкой.
	voiceBaseUrl: typeof ic.voiceBaseUrl === "string" ? ic.voiceBaseUrl : "",
};

// === Конфигурация тикетов Bitrix ===
export const ticketSiteId = config.ticketSiteId || "s1";
export const ticketCategoryId = config.ticketCategoryId || 43;
export const ticketSlaId = config.ticketSlaId || 1;

// === SLA / расписание ===
export const workScheduleId = config.workScheduleId || 0;
export const ticketSlaWorkDays =
	typeof config.ticketSlaWorkDays === "number" ? config.ticketSlaWorkDays : 2;

// === Список пользователей ===
export const userList = config.userList || {};

// === Отладка ===
export const debugLogin = config.debugLogin || "";
export const debugPassword = config.debugPassword || "";
export const debugAutoLogin = config.debugAutoLogin || false;
export const showTimeDebugUI = config.showTimeDebugUI || false;
