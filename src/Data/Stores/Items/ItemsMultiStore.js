import 'reflect-metadata';
import ItemsStore from './ItemsStore';
import { get, values, has} from 'mobx';


class ItemsMultiStore {
	/*tasks;
	tickets;
	jobs;
	plans;*/

    periods;
    time;
    users;
    main;
	ws;

	types;
	linkedPending={};	// cache requested ids to avoid repeated linked fetches

	/*findRelativesFor(item) {
		this.types.forEach(type => this[type].findRelativesFor(item))
	}*/

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

	//возвращает наборы всех ссылок по типам
	getLinkedUidsMap() {
		const map = {
			task: new Set(),
			ticket: new Set(),
		};
		this.types.forEach(type => { if (this[type]!==undefined) {
			values(this[type].items).forEach(item => {
				['parentUids', 'childUids'].forEach(key => {
					const links = item[key];
					if (!Array.isArray(links)) return;
					links.forEach(uid => {
						if (typeof uid !== 'string') return;
						if (uid.startsWith('task:')) {
							map.task.add(uid);
						}
						if (uid.startsWith('ticket:')) {
							map.ticket.add(uid);
						}
					});
				});
			});
		}});
		return map;
	}

	// возвращает массив всех ссылок в одном массиве
	getLinkedUids() {
		const map = this.getLinkedUidsMap();
		return [...map.task, ...map.ticket];
	}

	// возвращает UID текущих ссылок по конкретному типу
	getLinkedUidsByType(type) {
		const map = this.getLinkedUidsMap();
		return Array.from(map[type] || []);
	}

	// определяет, каких ссылок типа еще нет в сторе и не запрошены ранее
	getMissingLinkedUidsForType(type) {
		const store = this[type];
		if (!store) return [];
		const referenced = this.getLinkedUidsByType(type);
		//console.log('referenced', type, referenced);
		if (!referenced.length) return [];
		const pending = this.linkedPending[type] || new Set();
		const missing = [];
		referenced.forEach(uid => {
			const tokens = uid.split(':');
			if (tokens.length !== 2) return;
			const id = Number(tokens[1]);
			//console.log('checking', uid, id);
			if (!id) return;
			if (has(store.items, id)) return;
			if (pending.has(uid)) return;
			missing.push(id);
		});
		return missing;
	}

	markLinkedPending(type, uids) {
		if (!this.linkedPending[type]) this.linkedPending[type] = new Set();
		uids.forEach(uid => this.linkedPending[type].add(uid));
	}

	clearLinkedPending(type, uids) {
		if (!this.linkedPending[type]) return;
		uids.forEach(uid => this.linkedPending[type].delete(uid));
	}

	requestLinkedFetch(type = null) {
		console.log('requestLinkedFetch', type);
		const targets = type ? [type] : ['task', 'ticket'];
		targets.forEach(target => this.requestLinkedFetchForType(target));
	}

	requestLinkedFetchForType(type) {
		console.log('requestLinkedFetchForType', type);
		const store = this[type];
		if (!store) return;
		const missing = this.getMissingLinkedUidsForType(type);
		console.log('missing', missing);
		if (!missing.length) return;
		this.markLinkedPending(type, missing);
		store.loadLinkedItems(missing)
			.then(success => {
				this.clearLinkedPending(type, missing);
				if (!success) {
					return;
				}
				//this.requestLinkedFetch();
			})
			.catch(error => {
				console.error(error);
				this.clearLinkedPending(type, missing);
			});
	}

	buildReveseLinks(item) {
		this.types.forEach(type => this[type].buildReveseLinks(item))
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
			type: 'group',
			disabled: task.isClosed,
			children: [
				{
					label: '>> на 1 неделю',
					key: 'weekLater1',
					disabled: task.isClosed,
				},
				{
					label: '>> на 2 недели',
					key: 'weekLater2',
					disabled: task.isClosed,
				},
				{
					label: '>> на 1 месяц',
					key: 'monthLater1',
					disabled: task.isClosed,
				},
				{
					label: '>> на 2 месяца',
					key: 'monthLater2',
					disabled: task.isClosed,
				},
			]
		},
		{
			label: 'В долгий ящик',			
			type: 'group',
			disabled: task.isClosed,
			children: [
				{
					label: '>> на верх',
					key: 'bucketTop',
					disabled: task.isClosed,
				},
				{
					label: '>> на дно',
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
	
				default: console.log('unknown menu item');
			}
		}
}

export default ItemsMultiStore;
