import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import PeriodItem from './PeriodItem';
import {values, get,observe} from 'mobx';
import ItemsIdsStore from './Items/ItemsIdsStore';

class WeekItem {
    time;		//ссылка на объект - хранилище времени
    items;		//ссылка на объект - хранилище элементов
	periods;	//ссылка на объект - хранилище периодов
	layout;		//ссылка на объект - раскладка
	
	id;			//номер недели
    start;      //начало недели
    end;        //конец периода
	expand;		//внутреннее состояние expand под который построены периоды

	itemsTypes;
	itemsIds;
	periodsIds=[];
	itemsLoaded=false;


	filterItem(item) {
		return (
			(item.t !== null && item.t >= this.start && (
				(this.end !== null && item.t <= this.end)
				||
				this.end === null
			))
			||
			(item.t === null && this.end === null)
		);
	}

	attachItem(item) {
		if (!this.filterItem(item)) return false;
		this.itemsIds.attachItem(item);
	}

	detachItem(item) {
		this.itemsIds.detachItem(item);
	}

	attachItemsStore(items) {
		//console.log('attaching items');
		//console.log(items);
		if (this.items!==undefined) return;
		this.items=items;
	}

	/**
	 * Перепроверяет уже загруженные элементы на предмет что их нужно поместить в себя
	 */
	reloadItems() {
		if (this.items===undefined) return;
		this.itemsTypes.forEach(type=>{
			values(this.items[type].items).forEach(item=>item.findIterval([this.id]))
		})
	}

	reperiodItems() {
		if (this.items === undefined) return;
		this.itemsTypes.forEach(type => {
			//console.log(type)
			//console.log(get(this.itemsIds.ids[type]));
			get(this.itemsIds.ids,type)
			.forEach(i => {
				get(this.items[type].items, i)
				.findPeriod(this.periodsIds)
			})
		})
	}

    reinitPeriods() {
        console.log('interval periods reinit');
        this.expand=this.layout.expand;
        
        let len=this.layout.expand?	//длина периодов
            TimeHelper.dayLen:
            TimeHelper.weekLen;

		//чистим старые периоды
        this.periodsIds.forEach(t=>this.periods.deletePeriod(t));
		this.periodsIds=[];

		//для недели-долгого ящика нужен один такой же период
		if (this.end===null) {
			let period=new PeriodItem(this.start,null,this);
            this.periods.setPeriod(period);
			this.periodsIds.push(this.start);
		} else for (let t=this.start; t<this.end;t+=len) {
            let period=new PeriodItem(t,len-1,this);
            this.periods.setPeriod(period);
			this.periodsIds.push(t);
        }
		//console.log(this.items);
		this.reperiodItems();
	}

	init() {
		const start = this.time.weekStart(this.id);
		const end = this.id>this.time.weekMax?null:this.time.weekEnd(this.id);

		if (this.start !== start || this.end !== end) {
			this.start=start;
			this.end=end;
			this.reinitPeriods();
			this.itemsLoaded=false;
		}

		if (!this.itemsLoaded) 
			this.reloadItems();
	}


	/**
	 * 
	 * @param {*} id 
	 * @param {*} time 
	 * @param {*} items //может созадаваться до появления items
	 * @param {*} layout 
	 * @param {*} periods 
	 */
    constructor(id,main,time,items,layout,periods) {
        this.id=id;
        this.time=time;
        this.layout=layout;
        this.periods=periods;
		this.itemsTypes=main.itemsTypes;
		this.itemsIds = new ItemsIdsStore(this.itemsTypes);
		this.items = items;
		this.init();
		observe(layout,'expand',()=>{if (this.layout.expand !== this.expand) this.reinitPeriods()});
    }
}

export default WeekItem;