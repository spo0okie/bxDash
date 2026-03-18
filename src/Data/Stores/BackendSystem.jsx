import { observable, action, makeObservable } from 'mobx';

/** Статусы доступности бэкенда */
const STATUS = {
	UNINITIALIZED: 'Uninitialized',
	UNREACHABLE: 'Unreachable',
	UNAUTHORIZED: 'Unauthorized',
	PENDING: 'Pending',
	OK: 'OK',
	AUTH_FAIL: 'Authorization fail',
};

/**
 * Класс для управления подключением к бэкенд-системе.
 * Обеспечивает проверку доступности, аутентификацию и периодические проверки статуса.
 * 
 * Реактивные свойства (observable):
 * - availability - статус доступности бэкенда
 * - authStatus - статус аутентификации
 * - userId - идентификатор пользователя
 * 
 * Нереактивные свойства (конфигурация и секретные данные):
 * - login, password, token - учётные данные (не observable для безопасности)
 * - baseUrl, name, authConfig, intervals - конфигурация
 */
class BackendSystem {
	// Реактивные свойства
	availability = STATUS.UNINITIALIZED;
	authStatus = STATUS.UNAUTHORIZED;
	userId = null;

	// Секретные данные (не observable)
	login = null;
	password = null;
	token = null;

	// Конфигурация (не observable)
	baseUrl = '';

	constructor(name, authConfig = {}) {
		this.name = name;
		this.authConfig = authConfig;
		this.intervals = [];

		// Явное объявление реактивных свойств согласно стандарту MobX
		makeObservable(this, {
			availability: observable,
			authStatus: observable,
			userId: observable,
			setAvailability: action,
			setAuthStatus: action,
			setUrl: action,
			setUserId: action,
		});
	}

	/**
	 * Установка учётных данных для аутентификации
	 * @param {string} login - логин пользователя
	 * @param {string} password - пароль пользователя
	 */
	setLoginCredentials(login, password) {
		this.login = login;
		this.password = password;
		this.authenticate();
	}

	/**
	 * Установка статуса доступности бэкенда
	 * @param {string} status - статус из STATUS
	 */
	setAvailability(status) {
		this.availability = status;
	}

	/**
	 * Установка статуса аутентификации
	 * @param {string} status - статус из STATUS
	 */
	setAuthStatus(status) {
		this.authStatus = status;
	}

	/**
	 * Установка URL бэкенда и запуск проверок доступности
	 * @param {string} url - базовый URL бэкенда
	 */
	setUrl(url) {
		this.baseUrl = url;
		this.checkAvailability();
		this.startAvailabilityCheck();
	}

	/**
	 * Установка идентификатора пользователя
	 * @param {string|number} id - ID пользователя
	 */
	setUserId(id) {
		this.userId = id;
	}

	/**
	 * Выполнение запроса к бэкенду с таймаутом и обработкой ошибок
	 * @param {string} endpoint - конечная точка API
	 * @param {Object} options - опции fetch-запроса
	 * @returns {Promise<Response>} - ответ сервера
	 */
	async fetch(endpoint, options = {}) {
		if (this.availability !== STATUS.OK) {
			throw new Error('Backend is unreachable');
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 55000);

		options = this.authConfig.reqOptions(options, this);
		options.signal = controller.signal;
		try {
			const response = await fetch(this.baseUrl + endpoint, options);
			clearTimeout(timeoutId);

			if (response.status === 401 || response.status === 403) {
				this.setAuthStatus(STATUS.UNAUTHORIZED);
				console.log(this.name + ': Authorization failed');
				throw new Error('Authorization failed');
			}

			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error.name === 'AbortError') {
				console.log(this.name + ': Timeout');
				this.setAvailability(STATUS.UNREACHABLE);
			}
			console.log(error);
			throw error;
		}
	}

	/**
	 * Проверка доступности бэкенда
	 * Выполняет HEAD-запрос для проверки соединения
	 */
	async checkAvailability() {
		if (!this.baseUrl) {
			this.setAvailability(STATUS.UNINITIALIZED);
			return;
		}
		if (this.availability === STATUS.PENDING) return; // Не флудим запросами
		if (this.availability === STATUS.AUTH_FAIL) return; // В случае неудачи не повторяем запросы чтобы не тригерить защиту от брутфорса
		if (this.availability !== STATUS.OK) this.setAvailability(STATUS.PENDING);

		let checkUrl = this.baseUrl;
		let options = { method: 'HEAD' };
		if (this.authConfig.checkUrl) {
			checkUrl = this.authConfig.checkUrl(this.baseUrl, options);
		}
		try {
			const response = await fetch(checkUrl, options);
			// 401/403 указывают на доступность ресурса (просто требуется аутентификация)
			if (!response.ok && !response.redirected && ![401, 403].includes(response.status)) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			this.setAvailability(STATUS.OK);
			if (this.authStatus === STATUS.UNAUTHORIZED) this.authenticate();
		} catch (error) {
			console.log(this.name + ': connection ERR');
			console.log(error);
			this.setAvailability(STATUS.UNREACHABLE);
		}
	}

	/**
	 * Аутентификация на бэкенде
	 * Использует конфигурацию authConfig для выполнения запроса авторизации
	 */
	async authenticate() {
		if (this.authStatus === STATUS.PENDING || this.availability !== STATUS.OK || !this.login || !this.password) return;
		this.setAuthStatus(STATUS.PENDING);
		try {
			const auth = await this.authConfig.authorize(this);
			if (auth) {
				this.setAuthStatus(STATUS.OK);
				this.checkAuthStatus();
			} else {
				this.setAuthStatus(STATUS.AUTH_FAIL);
			}
		} catch (error) {
			console.error(this.name + ': Authentication error:', error);
			this.setAuthStatus(STATUS.AUTH_FAIL);
		}
	}

	/**
	 * Проверка статуса аутентификации
	 * Периодически вызывается для подтверждения активной сессии
	 */
	async checkAuthStatus() {
		try {
			const auth = await this.authConfig.authCheck(this);
			if (auth) {
				this.setAuthStatus(STATUS.OK);
			} else {
				this.setAuthStatus(STATUS.UNAUTHORIZED);
			}
		} catch (error) {
			console.error(this.name + ': Auth status check error:', error);
			this.setAuthStatus(STATUS.UNAUTHORIZED);
		}
	}

	/**
	 * Запуск периодических проверок доступности и статуса аутентификации
	 * - Проверка доступности: каждые 10 секунд
	 * - Проверка аутентификации: каждые 60 секунд
	 */
	startAvailabilityCheck() {
		this.clearIntervals();
		const availabilityInterval = setInterval(() => this.checkAvailability(), 10000);
		const authInterval = setInterval(() => this.checkAuthStatus(), 60000);
		this.intervals.push(availabilityInterval, authInterval);
	}

	/**
	 * Очистка всех интервалов проверок
	 */
	clearIntervals() {
		this.intervals.forEach(interval => clearInterval(interval));
		this.intervals = [];
	}

	/**
	 * Освобождение ресурсов при уничтожении объекта
	 */
	destroy() {
		this.clearIntervals();
	}
}

export default BackendSystem;
