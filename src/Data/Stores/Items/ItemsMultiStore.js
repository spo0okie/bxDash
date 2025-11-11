import 'reflect-metadata';
import ItemsStore from './ItemsStore';
import { get, values} from 'mobx';


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

	/*findRelativesFor(item) {
		this.types.forEach(type => this[type].findRelativesFor(item))
	}*/

	getUidItem(uid) {
		const tokens=uid.split(':');
		const type=tokens[0];
		//console.log(tokens);
		if (this[type]===undefined) return undefined;
		const id=Number(tokens[1]);
		//console.log(type,id);
		return get(this[type].items,id);
	}

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