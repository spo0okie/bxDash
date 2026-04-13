import 'reflect-metadata';
import ItemsStore from './ItemsStore';
import { get, values, has} from 'mobx';


class ItemsMultiStore {
	periods;
	time;
	users;
	main;
	ws;

	types;
	pendingLoadRunning=false;
	pendingLoadQueued=false;

	/*findRelativesFor(item) {
		this.types.forEach(type => this[type].findRelativesFor(item))
	}*/

	// ========================================
	// Проксирование свойств и методов поиска от task store
	// ========================================
	// Позволяет обращаться к методам поиска через items.searchQuery, items.searchResults и т.д.

	/**
	 * Геттер для строки поиска задач
	 * @returns {string} Текущая строка поиска
	 */
	get searchQuery() { return this.task?.searchQuery || ''; }

	/**
	 * Геттер для результатов поиска задач
	 * @returns {Array} Массив ID найденных задач
	 */
	get searchResults() { return this.task?.searchResults || []; }

	/**
	 * Геттер для флага выполнения поиска
	 * @returns {boolean} Флаг загрузки
	 */
	get isSearching() { return this.task?.isSearching || false; }

	/**
	 * Геттер для режима поиска
	 * @returns {boolean} Активен ли режим поиска
	 */
	get searchMode() { return this.task?.searchMode || false; }

	/**
	 * Устанавливает строку поиска
	 * @param {string} query - Строка поиска
	 */
	setSearchQuery(query) {
		if (this.task) this.task.setSearchQuery(query);
	}

	/**
	 * Устанавливает режим поиска
	 * @param {boolean} value - Включить/выключить режим поиска
	 */
	setSearchMode(value) {
		if (this.task) this.task.setSearchMode(value);
	}

	/**
	 * Очищает все параметры поиска
	 */
	clearSearch() {
		if (this.task) this.task.clearSearch();
	}

	/**
	 * Асинхронный поиск задач по строке запроса
	 * @param {string} query - Строка поиска (минимум 3 символа)
	 */
	searchTasks(query) {
		if (this.task) this.task.searchTasks(query);
	}

	//возвращает элемент по UID
	getUidItem(uid) {
		const tokens=uid.split(':');
		const type=tokens[0];
		//console.log(tokens);
		if (this[type]===undefined) return undefined;
		const id=Number(tokens[1]);
		//console.log(type,id);
		return get(this[type].items,id);
	}

	//возвращает массив элементов по массиву UIDs
	getUidsItems(uids) {
		let result=[];
		uids.forEach(uid=>{
			const item=this.getUidItem(uid);
			if (item!==undefined)
				result.push(item);
			//else 
			//	console.log(uid+' not found');
		})
		return result;
	}

	/**
	 * Распределяет UID, заявленные элементом (`requester`), по типам и
	 * инициирует загрузку недостающих объектов в соответствующих стор.
	 */
	requestRelated(requester, uids) {
		if (!Array.isArray(uids) || !requester) return;
		const bucket = {};
		uids.forEach(uid => {
			if (typeof uid !== 'string') return;
			const tokens = uid.split(':');
			if (tokens.length !== 2) return;
			const type = tokens[0];
			const id = Number(tokens[1]);
			if (!id || !this[type]) return;
			if (!bucket[type]) bucket[type] = new Set();
			bucket[type].add(id);
		});
		Object.keys(bucket).forEach(type => {
			const store = this[type];
			if (!store) return;
			const ids = Array.from(bucket[type]);
			store.addRelatedRequest(ids, requester);
			//store.loadLinkedItems(ids);
		});
	}

	/**
	 * Запускает единичную загрузку по `pending`-ID у каждого стора.
	 */
	loadPendingItems() {
		return Promise.all(this.types.map(type => {
			const store = this[type];
			if (!store) return Promise.resolve(true);
			return store.loadPendingItems();
		}));
	}

	/**
	 * Обертка над `loadPendingItems`, предотвращающая параллельные вызовы.
	 */
	requestPendingLoad() {
		if (this.pendingLoadRunning) {
			this.pendingLoadQueued = true;
			return;
		}
		this.pendingLoadRunning = true;
		this.loadPendingItems()
			.finally(() => {
				this.pendingLoadRunning = false;
				if (this.pendingLoadQueued) {
					this.pendingLoadQueued = false;
					this.requestPendingLoad();
				}
			});
	}

	isLoading() {
		let isLoading=false;
		this.types.forEach(type=>{
			isLoading=isLoading||this[type].isLoading;
		})
		return isLoading;
	}

    constructor(main,time,users,periods) {
        console.log('Items construct');
        this.main=main;
		this.types=main.itemsTypes;
        this.time=time;
        this.users=users;
        this.periods=periods;
		this.periods.attachItemsStore(this);

		this.types.forEach(type => this[type] = new ItemsStore(type, this))
    }


		contextMenu=(task)=>[
		{
			label: 'В начало списка',
			key: 'toTop',
			disabled: task.isClosed,
		},
		{
			label: 'В конец списка',
			key: 'toBottom',
			disabled: task.isClosed,
		},
		{
			label: 'Отодвинуть срок',
			disabled: task.isClosed,
			children: [
				{
					label: 'на 1 неделю',
					key: 'weekLater1',
					disabled: task.isClosed,
				},
				{
					label: 'на 2 недели',
					key: 'weekLater2',
					disabled: task.isClosed,
				},
				{
					label: 'на 1 месяц',
					key: 'monthLater1',
					disabled: task.isClosed,
				},
				{
					label: 'на 2 месяца',
					key: 'monthLater2',
					disabled: task.isClosed,
				},
			]
		},
		{
			label: 'В долгий ящик',
			disabled: task.isClosed,
			children: [
				{
					label: 'на верх',
					key: 'bucketTop',
					disabled: task.isClosed,
				},
				{
					label: 'на дно',
					key: 'bucketBottom',
					disabled: task.isClosed,
				},
			]
		},
		
	];

	contextMenuHandler=(task,cell)=>(e)=>{
			//console.log(e.key);
			const week=7*24*3600*1000;
			const month=30*24*3600*1000;
			if (e.key.startsWith("toUser:")) {				
				console.log(e.key.split(':'));
				const userId=Number(e.key.split(':')[1]);
				console.log(userId);
				task.update({ user: userId }, true);
				return;
			}
			switch(e.key) {
				case 'toTop': task.update({ sorting: cell.maxSorting?cell.maxSorting+100:100 }, true); break;
				case 'toBottom': task.update({ sorting: cell.minSorting?cell.minSorting-100:100 }, true); break;
				case 'weekLater1': task.update({ deadline: task.t+week*1 }, true); break;
				case 'weekLater2': task.update({ deadline: task.t+week*2 }, true); break;
				case 'monthLater1': task.update({ deadline: task.t+month*1 }, true); break;
				case 'monthLater2': task.update({ deadline: task.t+month*2 }, true); break;
				case 'bucketTop': {
					let bucketTasks=[...values(this['task'].items), ...values(this['job'].items)].filter((t)=>t.deadline===null && t.isOpen && t.user===cell.user);
					let bucketMaxSorting=bucketTasks.length?Math.max(...bucketTasks.map((t)=>t.sorting))+100:100;
					task.update({ sorting: bucketMaxSorting, deadline: null }, true); 
					break;
				}
				
				case 'bucketBottom': {
					let bucketTasks=[...values(this['task'].items), ...values(this['job'].items)].filter((t)=>t.deadline===null && t.isOpen && t.user===cell.user);
					let bucketMinSorting=bucketTasks.length?Math.max(...bucketTasks.map((t)=>t.sorting))-100:0;
					task.update({ sorting: bucketMinSorting, deadline: null }, true); 
					break;
				}
	
				case 'failed': task.update({ status: 0 }, true); break;
				case 'partial': task.update({ status: 1 }, true); break;
				case 'complete': task.update({ status: 2 }, true); break;
	
				default: console.log('unknown menu item: '+e.key);
			}
		}
}

export default ItemsMultiStore;
