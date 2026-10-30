import 'reflect-metadata';
import ItemsStore from './ItemsStore';
import { get, values, has} from 'mobx';
import notify from 'Helpers/Notify';
import { ITEM_TYPES } from 'Data/itemTypes';
import { SHIFT_INTERVALS, SET_INTERVALS, setInterval, shiftInterval, dateFieldOf, canShiftEarlier, shiftedDate } from 'Helpers/DateShift';


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

    constructor(main,time,users,periods,schedule) {
        console.log('Items construct');
        this.main=main;
		this.types=main.itemsTypes;
        this.time=time;
        this.users=users;
        this.periods=periods;
        this.schedule=schedule;
		this.periods.attachItemsStore(this);

		this.types.forEach(type => this[type] = new ItemsStore(type, this))
    }


	/**
	 * Подменю «В столбец»: столбцы канбан-доски владельца ячейки (cell.user).
	 * Работает и в календаре — там это единственный способ переложить элемент, не переключаясь в канбан.
	 * Столбцы берём без запуска загрузки (peek): меню строится при каждом рендере карточки,
	 * а загрузку запускает contextMenuOpen() при открытии меню.
	 */
	stageMenu=(task,cell)=>{
		if (!cell || cell.readOnly || !this.stages || !ITEM_TYPES[task.type]?.stages) return [];
		const owner=cell.user;
		const columns=this.stages.peek(owner);
		const current=columns?task.stageFor(owner):null;
		return [{
			label: 'В столбец',
			key: 'stageMenu',
			disabled: task.isClosed,
			children: columns
				? columns.map(stage=>({
					label: stage.title+(stage.id===current?' ✓':''),
					key: 'stage:'+stage.id,
					disabled: task.isClosed || stage.id===current,
				}))
				: [{ label: 'столбцы загружаются…', key: 'stage:loading', disabled: true }],
		}];
	}

	/** Обработчик onOpenChange контекстного меню карточки: подгружает столбцы владельца ячейки */
	contextMenuOpen=(cell)=>(open)=>{
		if (open && cell && this.stages) this.stages.ensure(Number(cell.user));
	}

		contextMenu=(task,cell=null)=>[
		{
			label: 'В начало списка',
			key: 'toTop',
			disabled: task.isClosed || cell?.readOnly,
		},
		{
			label: 'В конец списка',
			key: 'toBottom',
			disabled: task.isClosed || cell?.readOnly,
		},
		{
			//приблизить можно только настолько, чтобы дата не ушла в прошлое;
			//недоступные пункты приглушены, а не скрыты — меню не «прыгает»
			label: 'Устанвить срок',
			disabled: task.isClosed,
			children: SET_INTERVALS.map(interval=>({
				label: interval.label,
				key: 'timeset:'+interval.id,
				//disabled: !canShiftEarlier(task,interval.ms,this.time.today),
			})),
		},
		{
			label: 'Отодвинуть срок',
			disabled: task.isClosed,
			children: SHIFT_INTERVALS.map(interval=>({
				label: interval.label,
				key: 'later:'+interval.id,
				disabled: task.isClosed,
			})),
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
		...this.stageMenu(task,cell),
	];

	contextMenuHandler=(task,cell)=>(e)=>{
			//console.log(e.key);
			const week=7*24*3600*1000;
			const month=30*24*3600*1000;
			if (e.key.startsWith("toUser:")) {
				console.log(e.key.split(':'));
				const userId=Number(e.key.split(':')[1]);
				console.log(userId);
				const userName = get(this.users.items, userId)?.name ?? ('пользователь ' + userId);
				const label = task.label;
				task.update({ user: userId }, true, () => notify.success('Ответственный изменён: ' + userName, { title: label }));
				return;
			}
			//перенос в столбец канбан-доски владельца ячейки
			if (e.key.startsWith("stage:")) {
				if (cell.readOnly) return;
				const stage=this.stages?.stageById(Number(e.key.split(':')[1]));
				if (!stage) return;
				const label = task.label;
				//в канбане перенос виден сразу, в календаре — нет, поэтому там сообщаем
				const done = cell.kanban ? null : () => notify.success('Столбец: «' + stage.title + '»', { title: label });
				task.update({ stage: stage.id, stageUser: cell.user }, true, done);
				return;
			}
			//сдвиг срока: later:<интервал> / earlier:<интервал>
			if (e.key.startsWith("later:")) {
				const [direction,id]=e.key.split(':');
				const interval=shiftInterval(id);
				if (!interval) return;
				const earlier = direction==='earlier';
				if (earlier && !canShiftEarlier(task,interval.ms,this.time.today)) return;
				task.update({ [dateFieldOf(task)]: shiftedDate(task,interval.ms,earlier?-1:1,this.time.today) }, true);
				return;
			}
			//планирование срока на конкретное время
			if (e.key.startsWith("timeset:")) {
				const [direction,id]=e.key.split(':');
				const interval=setInterval(id);
				if (!interval) return;
				task.update({ [dateFieldOf(task)]: this.time.today+interval.ms }, true);
				return;
			}
			switch(e.key) {
				case 'toTop': task.update({ sorting: cell.maxSorting?cell.maxSorting+100:100 }, true); break;
				case 'toBottom': task.update({ sorting: cell.minSorting?cell.minSorting-100:100 }, true); break;
				case 'bucketTop': {
					let bucketTasks=[...values(this['task'].items), ...values(this['job'].items)].filter((it)=>it.t===null && it.isOpen && it.user===cell.user);
					let bucketMaxSorting=bucketTasks.length?Math.max(...bucketTasks.map((it)=>it.sorting))+100:100;
					task.update({ sorting: bucketMaxSorting, startDatePlan: null }, true);
					break;
				}

				case 'bucketBottom': {
					let bucketTasks=[...values(this['task'].items), ...values(this['job'].items)].filter((it)=>it.t===null && it.isOpen && it.user===cell.user);
					let bucketMinSorting=bucketTasks.length?Math.max(...bucketTasks.map((it)=>it.sorting))-100:0;
					task.update({ sorting: bucketMinSorting, startDatePlan: null }, true);
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
