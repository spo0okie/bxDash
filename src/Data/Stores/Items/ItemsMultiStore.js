import 'reflect-metadata';
import ItemsStore from './ItemsStore';
import { get} from 'mobx';


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


}

export default ItemsMultiStore;