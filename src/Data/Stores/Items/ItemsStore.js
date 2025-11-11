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
			this.setItem(Item);
			this.master.buildReveseLinks(Item);
        } else {
			//console.log('updating '+id);
			const Item = get(this.items, id)
			Item.loadData(data,true);
			this.master.buildReveseLinks(Item);
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

    //загрузить задачи из битрикс с отметки времени from и до отметки to
    loadItems(from,to,onComplete=null) {
		console.log('loading ' + this.type + 's');
        let url=this.type+'/load/'+Math.round(from/1000)+'/'+(to?(Math.round(to/1000)):null)+'/'+keys(this.users.items).join(',')+'?random='+TimeHelper.getTimestamp();
        let store=this;
        console.log(url);
		this.setLoading(true);
		when(()=>this.main.bx.authStatus==='OK',()=>{
			this.main.bx.fetch(url)
			.then((response) => response.json())
			.then((data) => {
				console.log('got ' +data.length+' '+ this.type + 's');
				data.forEach(function(item){store.initData(item)});
				if (onComplete) onComplete();
				this.setLoading(false);
				this.updateLoadRange(from,to);
			})
			.catch(error=>console.error(error));	
		})
    }
    
    //загрузить одну задачку по ID
    loadItem(id,onComplete=null) {
        let store=this;
		console.log('loading ' + this.type + ' ID '+id);
		when(()=>this.main.bx.authStatus==='OK',()=>{
			this.main.bx.fetch(this.type + '/get/'+id+'?random='+TimeHelper.getTimestamp())
				.then((response) => response.json())
				.then((data) => {
					console.log('got ' + data.length + ' ' + this.type + 's');
					data.forEach(function (item) { store.initData(item) });
					if (onComplete) onComplete();
				})
				.catch(error => {
					if (has(this.items, id)) {
						const Item = get(this.items,id);
						console.log(Item);
						Item.setUpdating(false);
						Item.alertItem();
					}
					console.error(error);     
				});
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