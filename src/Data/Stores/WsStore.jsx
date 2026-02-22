import TimeHelper from "Helpers/TimeHelper";
import { observable, action, makeObservable, when } from "mobx";

/**
 * WsStore - хранилище для управления WebSocket соединением
 * Обеспечивает реальное время обновлений для dashboard
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 */
export class WsStore {
	// === Свойства, которые НЕ должны быть observable ===
	/** @type {MainStore} Ссылка на главное хранилище */
	main;
	/** @type {Object} Ссылка на хранилище элементов */
	items;
	/** @type {UsersStore} Ссылка на хранилище пользователей */
	users;
	/** @type {string} URL WebSocket сервера */
	url;

	// === Observable свойства ===
	/** @type {WebSocket|null} Ссылка на WebSocket объект */
	socket = null;
	/** @type {number|null} ID соединения */
	id = null;
	/** @type {string} Статус соединения: 'connected', 'disconnected', 'connecting', 'OK', 'Pending', 'Disconnected' */
	connectionStatus = "disconnected";
	/** @type {number} Отметка последнего оповещения об активности */
	activityTimestamp = 0;
	/** @type {Array} Массив интервалов для очистки */
	intervals = [];

	/**
	 * Конструктор WsStore
	 * @param {string} url - URL WebSocket сервера
	 * @param {MainStore} main - Ссылка на главное хранилище
	 * @param {UsersStore} users - Ссылка на хранилище пользователей
	 * @param {Object} items - Ссылка на хранилище элементов
	 */
	constructor(url, main, users, items) {
		// Явное объявление реактивных свойств согласно стандарту MobX
		makeObservable(this, {
			// Observable свойства
			socket: observable.ref,  // ref - для хранения ссылки без глубокой реакции
			id: observable,
			connectionStatus: observable,
			activityTimestamp: observable,
			intervals: observable,
			// Actions - методы, изменяющие observable свойства
			setConnectionStatus: action,
			setId: action,
			connect: action,
			activityUpdate: action,
		});

		console.log("connecting " + url);
		this.main = main;
		this.items = items;
		items.ws = this;
		this.users = users;
		this.connect(url);

		// Собрать все телефоны из realPhones всех пользователей
		const pingInterval = setInterval(() => this.ping(), 10000);
		const checkConnectionInterval = setInterval(() => this.checkConnection(), 15000); // Проверка соединения каждые 15 секунд
		this.intervals.push(pingInterval, checkConnectionInterval);
	}

	// === Actions ===

	/**
	 * Установить статус соединения
	 * @param {string} status - Новый статус соединения
	 */
	setConnectionStatus(status) {
		this.connectionStatus = status;
	}

	/**
	 * Установить ID соединения
	 * @param {number|null} id - ID соединения
	 */
	setId(id) {
		this.id = id;
	}

	/**
	 * Подключиться к WebSocket серверу
	 * @param {string} url - URL WebSocket сервера
	 */
	connect(url) {
		this.url = url;
		this.setConnectionStatus("Pending");
		this.socket = new WebSocket(url);

		this.socket.addEventListener("open", () => {
			this.setConnectionStatus("OK");
			console.log("WebSocket connected");
		});

		this.socket.addEventListener("close", () => {
			this.setConnectionStatus("Disconnected");
			console.log("WebSocket disconnected");
		});

		this.socket.addEventListener("message", this.onMessage);

		this.socket.addEventListener("error", (error) => {
			console.error("WebSocket error:", error);
			this.setConnectionStatus("Disconnected");
		});

		// Отправить запрос на получение статусов телефонов
		when(() => this.connectionStatus === 'OK', () => {
			this.sendMessage({
				action: 'getPhonesStates',
				numbers: this.users ? this.users.allPhones : []
			})
		});
	}

	/**
	 * Обновить отметку времени активности
	 */
	activityUpdate() {
		this.activityTimestamp = TimeHelper.getTimestamp();
	}

	// === Методы обработки сообщений ===

	/**
	 * Обработчик входящих WebSocket сообщений
	 * @param {MessageEvent} message - Входящее сообщение
	 */
	onMessage = (message) => {
		try {
			const data = JSON.parse(message.data);

			switch (data.event) {
				case 'wsConnected':
					this.setId(Number(data.connection));
					console.log('WS Connection ID set to ' + this.id);
					break;
				case 'taskUpdate':
					if (this.items && this.items['task']) {
						this.items['task'].loadItem(Number(data.taskId));
					}
					break;
				case 'jobUpdate':
					if (this.items && this.items['job']) {
						this.items['job'].loadItem(Number(data.jobId));
					}
					break;
				case 'planUpdate':
					if (this.items && this.items['plan']) {
						this.items['plan'].loadItem(Number(data.id));
					}
					break;
				case 'ticketUpdate':
					if (this.items && this.items['ticket']) {
						this.items['ticket'].loadItem(Number(data.ticketId));
					}
					break;
				case 'ping':
					if (this.users) {
						this.users.updateConnection(data.connection);
					}
					break;
				case 'techSupportTicketer':
					if (this.users) {
						this.users.setDutyTicketer(data.user);
					}
					break;
				case 'techSupportShift':
					if (this.users) {
						this.users.setDutyPhone(data.phone);
					}
					break;
				case 'phonesStatusUpdate':
					// data.data: { phone1: state1, phone2: state2, ... }
					if (this.users && data.data) {
						Object.entries(data.data).forEach(([phone, state]) => {
							this.users.updatePhoneStatus(phone, state);
						});
					}
					break;
				/*
				case 'jobRemove':
					userJobRemove(data.jobId);
					break;
				case 'techSupportShift':
					userPhonesSetDuty(data.phone);
					break;*/
				default:
					console.log('Unknown event');
					console.log(data);
			}
		} catch (error) {
			console.error('Error parsing WebSocket message:', error);
		}
	}

	/**
	 * Отправить ping на сервер
	 */
	ping() {
		if (!this.main.bx.userId) {
			console.log('cant ping without user ID');
			return;
		}
		const connection = {
			id: this.id,
			userId: this.main.bx.userId,
			login: this.main.bx.login,
			activityTimestamp: this.activityTimestamp,
			pingTimestamp: TimeHelper.getTimestamp()
		}
		const message = {
			event: 'ping',
			connection: connection
		}
		this.sendMessage(message);
		this.users.updateConnection(connection);
	}

	/**
	 * Отправить сообщение через WebSocket
	 * @param {Object} data - Данные для отправки
	 */
	sendMessage = (data) => {
		if (this.connectionStatus !== 'OK') {
			console.log('cant send message, connection status is ' + this.connectionStatus);
			return;
		}
		try {
			this.socket.send(JSON.stringify(data));
		} catch (error) {
			console.error('Error sending WebSocket message:', error);
		}
	}

	/**
	 * Проверить соединение и переподключиться при необходимости
	 */
	checkConnection() {
		if (this.connectionStatus === "Disconnected") {
			console.log("Reconnecting WebSocket...");
			this.connect(this.url); // Переподключение
		}
	}

	/**
	 * Очистить все интервалы
	 */
	clearIntervals() {
		this.intervals.forEach(interval => clearInterval(interval));
		this.intervals = [];
	}

	/**
	 * Уничтожить хранилище и освободить ресурсы
	 */
	destroy() {
		this.clearIntervals();
		if (this.socket) {
			this.socket.close();
		}
	}
}
