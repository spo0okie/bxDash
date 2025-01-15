import {values, get, observe, when, has, keys} from 'mobx';

const PeriodItemsMixin = {

	filterItem(item) {
		if (this.emeregency) return false;
		return (
			(item.t !== null && item.t >= this.start && (
				(this.end !== null && item.t < this.end)
				||
				this.end === null
			))
			||
			(item.t === null && this.end === null)
		);
	},

	attachItem(item) {
		//if (!this.filterItem(item)) return false;
		this.itemsIds.attachItem(item);
	},

	detachItem(item) {
		this.itemsIds.detachItem(item);
	},

	countItems() {
		if (this.items === undefined) return 0;
		let total=0;
		this.itemsTypes.forEach(type => {
			total+=get(this.itemsIds.ids,type).length;
		})
		return total;
	}
}

export default PeriodItemsMixin;