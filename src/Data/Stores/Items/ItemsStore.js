import 'reflect-metadata';
import {observable, when, makeObservable, keys , get, set, action, has, remove, observe} from 'mobx';
import TaskItem from 'Data/Items/TaskItem';
import JobItem from 'Data/Items/JobItem';
import DashItem from 'Data/Items/DashItem';
import PlanItem from 'Data/Items/PlanItem';
import TicketItem from 'Data/Items/TicketItem';
import MemoItem from 'Data/Items/MemoItem';
import AbsentItem from 'Data/Items/AbsentItem';
import TimeHelper from 'Helpers/TimeHelper';

class ItemsStore {
    items = new observable.map([],{deep:true});
	type = 'dash';
	isLoading=true;		//пока ничего не загрузили, считаем что еще загружаем
	linkedLoadInProgress=false;	//флаг, чтобы не вызывать linked-загрузки одновременно

	master;
    periods;
    time;
    users;
    main;
	ws;

	loadedFrom;
	loadedTo;

    newTaskTemplate={};

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
			//console.log('creating new '+ this.type);
			const Item = new className({}, data, this);
			if (className === MemoItem) console.log(Item);
			this.setItem(Item);
			this.master.buildReveseLinks(Item);
        } else {
			//console.log('updating '+id);
			const Item = get(this.items, id)
			Item.loadData(data,true);
			//не вижу смысла повторно искать обратные ссылки при обновлении элемента с сохранением id
			//this.master.buildReveseLinks(Item);
        }
        //console.log(this.tasks[id]);
    }    

	/**
	 * Ищем среди наших элементов родителя для переданного элемента
	 * @param {*} item 
	 *
	findParentFor(child) {
		this.items.forEach(item => child.checkParent(item));
	}


	/**
	 * Ищем среди наших элементов потомков для переданного элемента
	 * @param {*} item 
	 *
	findChildrenFor(parent) {
		this.items.forEach(item => item.checkParent(parent));
	}


	findRelativesFor(item) {
		this.findParentFor(item);
		this.findChildrenFor(item);
	}/** */

	buildReveseLinks(item) {
		this.items.forEach(test => test.reverseLinksCheck(item));
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

	getLinkedIdsParam() {
		const linkedIds = this.master.getLinkedUids();
		if (!linkedIds.length) return '';
		return '&ids=' + encodeURIComponent(linkedIds.join(','));
	}

    //загрузить задачи из битрикс с отметки времени from и до отметки to
	// первичный запрос по временным рамкам/пользователям + ids, затем инициируем linked fetch
	loadItems(from,to,onComplete=null) {
		console.log('loading ' + this.type + 's');
		const linkedParam = this.getLinkedIdsParam();
		const url = this.type + '/load/' + Math.round(from/1000) + '/' + (to ? Math.round(to/1000) : null) + '/' + keys(this.users.items).join(',') + '?random=' + TimeHelper.getTimestamp() + linkedParam;
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
				//если в элементах могут быть ссылки на другие объекты - инициируем их дозагрузку
				if (this.type in ['memo','job','plan']) this.master.requestLinkedFetch();
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
		const linkedParam = this.getLinkedIdsParam();
		return when(()=>this.main.bx.authStatus==='OK')
			.then(()=>this.main.bx.fetch(this.type + '/get/'+id+'?random='+TimeHelper.getTimestamp()+linkedParam))
			.then((response) => response.json())
			.then((data) => {
				console.log('got ' + data.length + ' ' + this.type + 's');
				data.forEach(function (item) { store.initData(item) });
				if (onComplete) onComplete();
				//this.master.requestLinkedFetch();
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

	// запрос только по ids (не зависит от временных границ) для дозагрузки ссылочных объектов
	loadLinkedItems(ids) {
		console.log('loadLinkedItems', ids);
		if (!ids.length) return Promise.resolve(true);
		const idsParam = encodeURIComponent(ids.join(','));
		const url = this.type + '/linked?random=' + TimeHelper.getTimestamp() + '&ids=' + idsParam;
		console.log('loading linked ' + this.type + 's: ' + idsParam);
		this.linkedLoadInProgress = true;
		const store = this;
		return when(()=>this.main.bx.authStatus==='OK')
			.then(()=>this.main.bx.fetch(url))
			.then(response => response.json())
			.then(data => {
				console.log('got ' + data.length + ' linked ' + this.type + 's');
				data.forEach(function(item){store.initData(item)});
				return true;
			})
			.catch(error => {
				console.error(error);
				return false;
			})
			.finally(()=>{
				this.linkedLoadInProgress=false;
			});
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
	}

	deleteItem(item) { 
		item.unsetPeriod();
		item.unsetInterval();
		item.detachLinks();
		remove(this.items, item.id);
	}

	loadPending(onComplete=null) {
		let to=null;									//обозначаем что загружаем весь период времени
		let from=this.time.firstWeekStart();			//если у нас уже загружены данные и мы подгружаем предыдущий период
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

	getMaxId() {
		let max=0;
		keys(this.items).forEach(i=>max=Math.max(max,i));		
		return max;
	}

    constructor(type,master) {
        console.log('Items construct');
		this.type=type;
		this.master = master;
		this.main = master.main;
		this.time = master.time;
		this.users = master.users;
		this.periods = master.periods;
        makeObservable(this,{
			items:observable,
			isLoading:observable,
			initData:action,
			setItem: action,
			updateItem: action,
			deleteItem:action,
			setLoading:action,
		});
        this.init();
    }


	

}

export default ItemsStore;