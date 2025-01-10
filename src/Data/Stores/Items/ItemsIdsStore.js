import 'reflect-metadata';
import {observable, makeObservable, action, } from 'mobx';

class ItemsIdsStore {
	ids = {};

	attachItem(item) {
		if (this.ids[item.type] === undefined) {this.ids[item.type]=[]}
		if (!this.ids[item.type].includes(item.id)) this.ids[item.type].push(item.id);
	}

	detachItem(item) {
		if (this.ids[item.type] === undefined) return;
		const i = this.ids[item.type].indexOf(item.id); 
		if (i > -1) this.ids[item.type].splice(i, 1); 
	}

    constructor(types) {
		//console.log(types);
		types.forEach(type => this.ids[type]=[]);
		makeObservable(this,{
			ids:observable,
			attachItem:action,
			detachItem:action
		})
    }
}

export default ItemsIdsStore;