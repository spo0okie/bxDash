import 'reflect-metadata';
import {observable, when, makeObservable, keys , get, set, action, has, remove, observe} from 'mobx';
import TaskItem from 'Data/Models/TaskItem';
import JobItem from 'Data/Models/JobItem';
import DashItem from 'Data/Models/DashItem';
import PlanItem from 'Data/Models/PlanItem';
import TicketItem from 'Data/Models/TicketItem';
import MemoItem from 'Data/Models/MemoItem';
import AbsentItem from 'Data/Models/AbsentItem';
import TimeHelper from 'Helpers/TimeHelper';

class ItemsStore {
	items = new observable.map([],{deep:true});
	type = 'dash';
	isLoading=true;		//пока ничего не загрузили, считаем что еще загружаем
	isLoadingLinked=false;	//флаг, чтобы не вызывать linked-загрузки одновременно
	relatedIds=new Set();
	pending={};

	master;
    periods;
    time;
    users;
    main;
	ws;

	loadedFrom;
	loadedTo;

    newTaskTemplate={};

    // Свойства для поиска задач
	searchQuery=''; // Строка поиска
	searchResults=[]; // Массив ID найденных задач
	isSearching=false; // Флаг выполнения поиска
	searchMode=false; // Флаг активности режима поиска

	classMap={
		'dash':		DashItem,
		'task':		TaskItem,
		'job':		JobItem,
		'plan':		PlanItem,
		'ticket':	TicketItem,
		'memo':		MemoItem,
		'absent':	AbsentItem,
	}

	setLoading(value) {
		this.isLoading=value;
	}

	setLoadingLinked(value) {
		this.isLoadingLinked=value;
	}

	// Actions для поиска

	/**
	 * Устанавливает строку поиска
	 * @param {string} query - Строка поиска
	 */
	setSearchQuery(query) {
		this.searchQuery = query;
	}

	/**
	 * Устанавливает режим поиска
	 * @param {boolean} value - Включить/выключить режим поиска
	 */
	setSearchMode(value) {
		this.searchMode = value;
	}

	/**
	 * Устанавливает флаг выполнения поиска
	 * @param {boolean} value - Флаг загрузки
	 */
	setIsSearching(value) {
		this.isSearching = value;
	}

	/**
	 * Очищает все параметры поиска
	 */
	clearSearch() {
		this.searchQuery = '';
		this.searchResults = [];
		this.isSearching = false;
		this.searchMode = false;
	}

	/**
	 * Асинхронный поиск задач по строке запроса
	 * @param {string} query - Строка поиска (минимум 3 символа)
	 */
	async searchTasks(query) {
		if (!query || query.length < 3) return;

		this.setIsSearching(true);
		try {
			const response = await this.main.bx.fetch(
				`task/search?q=${encodeURIComponent(query)}&random=${TimeHelper.getTimestamp()}`
			);
			const data = await response.json();

			// Загрузить задачи через существующий initData
			data.forEach(item => this.initData(item));

			// Сохранить ID найденных задач
			this.searchResults = data.map(item => Number(item.ID));
			this.searchMode = true;
		} catch (error) {
			console.error('Search error:', error);
		} finally {
			this.setIsSearching(false);
		}
	}


	//отправить произвольное сообщение
	broadcast = (msg) => { if (this.master.ws !== undefined) this.master.ws.sendMessage(msg);}

	//обновить таймер активности пользователя
	activityUpdate = () => { if (this.master.ws !== undefined) this.master.ws.activityUpdate();}

	//отправить сообщение об обновлении элемента
	broadcastUpdate = (id) => {
		this.broadcast({
			event: this.type + 'Update',
			[this.type + 'Id']: id,
			id: id
		})
	}

	//отправить сообщение об обновлении элемента
	broadcastRemove = (id) => {
		this.broadcast({
			event: this.type + 'Remove',
			[this.type + 'Id']: id,
			id: id
		})
	}

	/**
	 * Контекст для элементов
	 * @returns 
	 */
	getContext(){
		return {
			time: this.time,
			main: this.main,
			items: this,
			users: this.users,
			periods: this.periods,
		};
	}

    //создать/обновить элемент из JSON данных объекта из битрикс
	initData(data){
		const id = Number(data.ID);
		const className = this.classMap[this.type];
		if (!has(this.items,id)) {
			const Item = new className({}, data, this);
			//if (className === MemoItem) console.log(Item);
			this.setItem(Item);
		} else {
			const Item = get(this.items, id)
			Item.loadData(data,true);
		}
		//console.log(this.tasks[id]);
	}

	/**
	 * Регистрирует идентификаторы, которые требуются `requester`.
	 * Новые IDs попадают в связанный сет `relatedIds`, а если сам объект
	 * уже загружен, сразу пробивает обратную ссылку.
	 */
	addRelatedRequest(ids, requester) {
		if (!Array.isArray(ids) || !requester) return;
		ids.forEach(rawId => {
			const id = Number(rawId);
			if (!id) return;
			this.relatedIds.add(id);
			if (has(this.items, id)) {
				requester.reverseLinksCheck(get(this.items, id));
				return;
			}
			const key = String(id);
			if (!this.pending[key]) this.pending[key] = new Set();
			this.pending[key].add(requester);
		});
	}

	/**
	 * Уведомляет ожидающие объекты, когда `item` появился в сторе.
	 */
	resolvePending(item) {
		if (!item) return;
		const key = String(item.id);
		const waiters = this.pending[key];
		if (!waiters) return;
		waiters.forEach(requester => {
			if (typeof requester.reverseLinksCheck === 'function') {
				requester.reverseLinksCheck(item);
			}
		});
		delete this.pending[key];
	}

	/**
	 * Возвращает все `id`, которые ещё ждут загрузки из `pending`.
	 */
	getPendingIds() {
		return Object.keys(this.pending)
			.filter(key => this.pending[key] && this.pending[key].size)
			.map(key => Number(key));
	}

	updateLoadRange(from,to) {
		if (this.loadedFrom===undefined) {
			this.loadedFrom=from;
		} else if (this.loadedFrom>from) {
			this.loadedFrom=from;
		}

		if (this.loadedTo===undefined || to===null) {
			this.loadedTo=to;
			return;
		}

		if (this.loadedTo===null) return;
		//с этого места ни loadedTo ни to не null

		if (this.loadedTo<to) {
			this.loadedTo=to;
		}
	}

	/**
	 * Формирует `ids`-параметр для запросов из набора `relatedIds`,
	 * чтобы явно загрузить связанные записи.
	 */
	getIdsParam() {
		if (!this.relatedIds.size) return '';
		const tokens = Array.from(this.relatedIds).map(id => `${this.type}:${id}`);
		return '&ids=' + encodeURIComponent(tokens.join(','));
	}

    //загрузить задачи из битрикс с отметки времени from и до отметки to
	// первичный запрос по временным рамкам/пользователям + ids, затем инициируем linked fetch
	loadItems(from,to,onComplete=null) {
		console.log('loading ' + this.type + 's');
		const idsParam = this.getIdsParam();
		const url = this.type + '/load/' + Math.round(from/1000) + '/' + (to ? Math.round(to/1000) : null) + '/' + keys(this.users.items).join(',') + '?random=' + TimeHelper.getTimestamp() + idsParam;
		const store = this;
		this.setLoading(true);
		return when(() => this.main.bx.authStatus==='OK')
			.then(() => this.main.bx.fetch(url))
			.then(response => response.json())
			.then(data => {
				console.log('got ' + data.length + ' ' + this.type + 's');
				data.forEach(function(item) { store.initData(item); });
				if (onComplete) onComplete();
				this.updateLoadRange(from,to);
				//после первичной загрузки пытаемся дозапросить pending-элементы
				this.master.requestPendingLoad();
				return true;
			})
			.catch(error => {
				console.error(error);
				return false;
			})
			.finally(() => {
				this.setLoading(false);
			});
	}
    
	//загрузить одну задачку по ID
	loadItem(id,onComplete=null) {
		const store=this;
		console.log('loading ' + this.type + ' ID '+id);
		return when(()=>this.main.bx.authStatus==='OK')
			.then(()=>this.main.bx.fetch(this.type + '/get/'+id+'?random='+TimeHelper.getTimestamp()))
			.then((response) => response.json())
			.then((data) => {
				console.log('got ' + data.length + ' ' + this.type + 's');
				data.forEach(function (item) { store.initData(item) });
				if (onComplete) onComplete();
				this.loadPendingItems();
				return true;
			})
			.catch(error => {
				if (has(this.items, id)) {
					const Item = get(this.items,id);
					console.log(Item);
					Item.setUpdating(false);
					Item.alertItem();
				}
				console.error(error);
				return false;
			});
	}

	/**
	 * Запрос по `ids`, используемый для дозагрузки связанных объектов,
	 * принципиален момент что не загружает те элементы которые уже есть в сторе(!),
	 * которые ещё не пришли в основной нагрузке.
	 */
	loadLinkedItems(ids) {
		const cleaned = [...new Set(ids.map(Number))].filter(id => !!id);
		const missing = cleaned.filter(id => !has(this.items, id));
		const store=this;
		if (!missing.length) return Promise.resolve(true);
		return when(()=>store.main.bx.authStatus==='OK' && !store.isLoading && !store.isLoadingLinked)
			.then(()=>{
				store.setLoadingLinked(true);
				const url = store.type + '/linked?random=' + TimeHelper.getTimestamp() + '&ids=' + encodeURIComponent(missing.join(','));
				return this.main.bx.fetch(url);
			})
			.then(response => response.json())
			.then(data => {
				console.log('got ' + data.length + ' linked ' + this.type + 's');
				data.forEach(function(item){
					store.initData(item)}
				);
				return true;
			})
			.catch(error => {
				console.error(error);
				return false;
			})
			.finally(()=>{
				store.setLoadingLinked(false);
			});
	}

	/**
	 * Загружает все pending-элементы, ожидающие загрузки.
	 * @returns 
	 */
	async loadPendingItems() {
		const store=this;
		//откладываем загрузку пока идет основная загрузка или linked-загрузка
		return when(()=>store.main.bx.authStatus==='OK' && !store.isLoading && !store.isLoadingLinked)
			.then(()=>{
				const ids = store.getPendingIds();
				if (!ids.length) return Promise.resolve(true);
				return store.loadLinkedItems(ids);
			});
	}

	/**
	 * Загружает все pending-периоды.
	 * @param {*} onComplete 
	 * @returns 
	 */
	loadPending(onComplete=null) {
		let	to=null;									//обозначаем что загружаем весь период времени (правой границы нет)
		let	from=this.time.firstWeekStart();			//если у нас уже загружены данные и мы подгружаем предыдущий период
		if (this.loadedTo===null && this.loadedFrom!==undefined && this.loadedFrom>from) {
			to=this.loadedFrom;							//то ограничиваем сверху загруженный период 
		}
		if (this.loadedTo!==undefined && this.loadedFrom!==undefined && (this.loadedTo===null || to<this.loadedTo) && (from>=this.loadedFrom )) {
			console.log('nothing pending load');
			return;
		}
		this.loadItems(from,to,onComplete);
	}

	recalcPeriods() {
		console.log('recalc periods');
		this.items.forEach(test => {
			test.recalcTime();
			test.findInterval();

		});
	}

    init() {
		console.log(this.type + 's init');
        const users=this.users.items;
        when(()=>users.size,()=>{
            this.loadPending();
			let reloadInterval=0;
			//перегружаем время от времени задачи и заявки, т.к. их обновления могут проскакивать мимо WS канала
			if (this.type==='task') reloadInterval=5*60*1000;
			if (this.type==='ticket') reloadInterval=2*60*1000;
			if (reloadInterval) {
				setInterval(()=>{
					console.log(this.type + 's reload');
					this.loadItems(this.time.firstWeekStart(),null);
				},reloadInterval)
			}
        });
		
		//если мы поменяли первую неделю, то возмножно надо подгрузить старые даныне
		observe(this.time,'weekMin',change=>{this.loadPending()});							

		//если поменялось "сегодня" то возможно поменялись и границы недель (вс->пн), но при движении времени вперед ничего нового не подгрузить
		//а вот пересчитать временные отметки элементов имеет смысл, т.к. все просрочки сдвинутся вперед
		observe(this.time,'today',change=>{this.recalcPeriods()});
    }

	updateItem(item) {
		if (has(this.items, item.id)) {
			//console.log(get(this.items, item.id));
			//если такой элемент есть - обновляем его поля (поштучно)
			Object.keys(item).forEach((key) => {
				console.log('Updating ' + this.type + ' ' + item.id + ': ' + key + ' => ' + item[key]);
				get(this.items, item.id)[key] = item[key];
			});
		} else {
			//иначе просто создаем новый
			this.setItem(item);
		}
	}

	setItem(item){
		set(this.items, item.id, item);
		this.resolvePending(item);
	}

	deleteItem(item) { 
		item.unsetPeriod();
		item.unsetInterval();
		item.detachLinks();
		remove(this.items, item.id);
	}

	getMaxId() {
		let max=0;
		keys(this.items).forEach(i=>max=Math.max(max,i));		
		return max;
	}

    constructor(type,master) {
        //console.log('Items construct');
		this.type = type;
		this.master = master;
		this.main = master.main;
		this.time = master.time;
		this.users = master.users;
		this.periods = master.periods;
        makeObservable(this,{
        items:observable,
        isLoading:observable,
        isLoadingLinked:observable,
        // Свойства для поиска
        searchQuery:observable,
        searchResults:observable,
        isSearching:observable,
        searchMode:observable,
        initData:action,
        setItem:action,
        updateItem:action,
        deleteItem:action,
        setLoading:action,
        setLoadingLinked:action,
        // Actions для поиска
        setSearchQuery:action,
        setSearchMode:action,
        setIsSearching:action,
        clearSearch:action,
        searchTasks:action,
        });
        this.init();
    }
}

export default ItemsStore;
