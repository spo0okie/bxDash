import 'reflect-metadata';
import { observable, when, makeObservable, runInAction, get, set, action, computed, keys, has, observe } from 'mobx';
import UserItem from 'Data/Models/UserItem';


const STATE_PRIORITY_REVERSE = {
	"RINGING": 50,
	"INUSE": 40,
	"IDLE": 30,
	"UNAVAILABLE": 20,
	"UNKNOWN": 10,
};

/**
 * Хранилище пользователей dashboard
 * Управляет списком пользователей, их статусами и порядком отображения
 */
class UsersStore {
	/** @type {MainStore} Ссылка на главное хранилище (не observable) */
	main;

	/** @type {number|null} ID пользователя, над которым сейчас мышь */
	hovered = null;

	/** @type {number|null} ID выбранного пользователя для фильтрации */
	selected = null;

	/** @type {ObservableMap<number, UserItem>} Карта пользователей */
	items = observable.map();

	/** @type {number[]} Порядок отображения пользователей */
	order = [];

	/** @type {boolean} Флаг инициализации хранилища */
	initialized = false;

	/** @type {number|null} ID текущего авторизованного пользователя */
	current = null;

	/** @type {number|null} ID дежурного по телефону */
	dutyPhone = null;

	/** @type {number|null} ID дежурного по тикетам */
	dutyTicketer = null;

	/** @type {string[]} Все телефоны всех пользователей */
	allPhones = observable.array();

	/**
	 * Загружает опцию из локального хранилища
	 * @param {string} name - Имя опции
	 * @returns {*} Значение опции
	 */
	loadOption(name) {
		return this.main.loadOption('users.' + name);
	}

	/**
	 * Сохраняет опцию в локальное хранилище
	 * @param {string} name - Имя опции
	 * @param {*} value - Значение
	 * @returns {*} Результат сохранения
	 */
	saveOption(name, value) {
		return this.main.saveOption('users.' + name, value);
	}

	/**
	 * Загружает дополнительные данные пользователя из Inventory
	 * @param {UserItem} item - Элемент пользователя
	 */
	async loadUser(item) {
		const store = this;
		when(() => this.main.inventoryAuth, () => {
			this.main.inventory.get('users', 'search', { 'login': item }, function (data) {
				if (data.Ename) {
					item.name = data.Ename.split(' ')[0];
					item.phone = data.Phone;
					runInAction(() => { store.updateItem(item) });
				} else {
					console.log(data);
				}
			});
		});
	}

	/**
	 * Возвращает контекст для элементов
	 * @returns {Object} Контекст с ссылками на хранилища
	 */
	getContext() {
		return {
			time: this.time,
			main: this.main,
			items: this,
			users: this,
			periods: this.periods,
		};
	}

	/**
	 * Инициализирует хранилище списком пользователей
	 * @param {Object} items - Объект с данными пользователей
	 */
	init(items) {
		if (this.items) {
			this.items.clear();
		} else {
			this.items = observable.map();
		}
		Object.keys(items).forEach((id) => {
			const item = items[id];
			item.id = Number(id);
			this.initItem(item);
			if (item.roles.includes('user') && !this.order.includes(item.id)) {
				this.order.push(item.id);
			}
		});
		for (let i = this.order.length - 1; i >= 0; i--) {
			if (!has(this.items, this.order[i])) {
				this.order.splice(i);
			} else if (!get(this.items, this.order[i]).roles.includes('user')) {
				this.order.splice(i);
			}
		}
		console.log(this.order);
		this.initialized = true;
	}

	/**
	 * Устанавливает текущего пользователя
	 * @param {number} value - ID пользователя
	 */
	setCurrent(value) {
		console.log(value);
		when(() => this.initialized, () => {
			console.log(value);
			if (has(this.items, value)) {
				console.log('current user is ' + value);
				this.current = value;
			}
		});
	}

	/**
	 * Создаёт или обновляет элемент пользователя из данных
	 * @param {Object} data - Данные пользователя
	 */
	initItem(data) {
		const id = Number(data.id);
		data.realPhones = [data.phone, ...(data.additionalPhones ?? [])];
		this.allPhones.push(...data.realPhones);

		console.log(data);
		if (!has(this.items, id)) {
			const Item = new UserItem(data, {}, this);
			this.setItem(Item);
		} else {
			const Item = get(this.items, id);
			Item.init(data);
		}
	}

	/**
	 * Возвращает количество пользователей
	 * @returns {number} Количество пользователей
	 */
	get count() {
		return keys(this.items).length;
	}

	/**
	 * Сохраняет элемент пользователя в хранилище
	 * @param {UserItem} item - Элемент пользователя
	 */
	setItem(item) {
		set(this.items, item.id, item);
	}

	/**
	 * Проверяет, является ли текущий пользователь администратором
	 * @returns {boolean} true если пользователь администратор
	 */
	get isAdmin() {
		if (!this.current) return false;
		return get(this.items, this.current).roles.includes('admin');
	}

	/**
	 * Обновляет элемент пользователя
	 * @param {UserItem} item - Элемент с обновлёнными данными
	 */
	updateItem(item) {
		if (has(this.items, item.id)) {
			Object.keys(item).forEach((key) => {
				console.log('Updating ' + this.type + ' ' + item.id + ': ' + key + ' => ' + item[key]);
				get(this.items, item.id)[key] = item[key];
			});
		} else {
			this.setItem(item);
		}
	}

	/**
	 * Обновляет статус соединения пользователя
	 * @param {Object} connection - Данные соединения
	 */
	updateConnection(connection) {
		const uid = Number(connection.userId);
		if (has(this.items, uid)) {
			get(this.items, uid).updateConnection(connection);
		}
	}

	/**
	 * Устанавливает наведение на пользователя
	 * @param {number|null} id - ID пользователя
	 */
	setHover(id) {
		this.hovered = id;
	}

	/**
	 * Устанавливает выбранного пользователя
	 * @param {number|null} id - ID пользователя
	 */
	setSelect(id) {
		console.log(id);
		this.selected = id;
		this.saveOption('selected', id);
	}

	/**
	 * Устанавливает дежурного по тикетам
	 * @param {number|null} id - ID пользователя
	 */
	setDutyTicketer(id) {
		if (this.dutyTicketer === id) return;
		this.dutyTicketer = id;
	}

	/**
	 * Устанавливает дежурного по телефону
	 * @param {number|null} id - ID пользователя
	 */
	setDutyPhone(id) {
		if (this.dutyPhone === id) return;
		this.dutyPhone = id;
	}

	/**
	 * Устанавливает порядок отображения пользователей
	 * @param {number[]} value - Массив ID пользователей
	 */
	setOrder(value) {
		this.order = value;
		this.saveOption('order', value);
	}

	/**
	 * Обновляет статус телефона пользователя по номеру телефона
	 * @param {string} phone - Номер телефона
	 * @param {string} status - Статус телефона
	 */
	updatePhoneStatus(phone, status) {
		phone = Number(phone);
		let user = null, idx = -1;
		for (const id of keys(this.items)) {
			const item = get(this.items, id);
			if (item.realPhones && Array.isArray(item.realPhones)) {
				const i = item.realPhones.indexOf(phone);
				if (i !== -1) {
					user = item;
					idx = i;
					break;
				}
			}
		}
		if (!user || idx === -1) return;

		// Инициализируем массив статусов телефонов
		if (!user.realPhonesStatuses) user.realPhonesStatuses = [];

		// Обновляем статус телефона
		user.realPhonesStatuses[idx] = status;

		// Вычисляем максимальный приоритет статуса
		let maxPriority = 0;
		let maxState = "UNKNOWN";
		for (let s of user.realPhonesStatuses) {
			const prio = STATE_PRIORITY_REVERSE[s] ?? 10;
			if (prio > maxPriority) {
				maxPriority = prio;
				maxState = s;
			}
		}
		if (user.phoneStatus !== maxState) {
			user.setPhoneStatus(maxState);
		}
	}

	contextMenu=(item)=>[{
		label: 'Передать сотруднику',
		disabled: item.isClosed,
		children: this.order.map((i,index) => {
			const user=get(this.items,i);
			return {
				label: user.name,
				key: 'toUser:'+user.id,
				disabled: item.isClosed,
			}
		})
	}];

	/**
	 * Конструктор хранилища пользователей
	 * @param {MainStore} main - Ссылка на главное хранилище
	 */
	constructor(main) {
		this.main = main;
		this.selected = this.loadOption('selected') ?? null;
		this.order = this.loadOption('order') ?? [];

		// Явное объявление реактивных свойств
		makeObservable(this, {
			hovered: observable,
			selected: observable,
			items: observable,
			order: observable,
			initialized: observable,
			current: observable,
			dutyPhone: observable,
			dutyTicketer: observable,
			allPhones: observable,
			init: action,
			setCurrent: action,
			initItem: action,
			setItem: action,
			updateItem: action,
			setHover: action,
			setSelect: action,
			setDutyTicketer: action,
			setDutyPhone: action,
			setOrder: action,
			count: computed,
			isAdmin: computed,
		});

		this.setCurrent(this.main.bx.userId);
		observe(this.main.bx, 'userId', change => { this.setCurrent(this.main.bx.userId) });
	}

}

export default UsersStore;
