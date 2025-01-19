import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import PeriodItem from './PeriodItem';
import {values, get, observe, when, has, keys} from 'mobx';
import ItemsIdsStore from '../Items/ItemsIdsStore';
import PeriodItemsMixin from './PeriodItemsMixin';

class IntervalItem {
    time;		//ссылка на объект - хранилище времени
    items;		//ссылка на объект - хранилище элементов
	periods;	//ссылка на объект - хранилище периодов
	layout;		//ссылка на объект - раскладка
	
	id;			//номер недели
    start;      //начало недели
    end;        //конец периода
	expand;		//внутреннее состояние expand под который построены периоды
	today;		//отметка "сегодня" относительно которой опредлены флаги открытого/закрытого периода

	itemsTypes;
	itemsIds;
	periodsIds=[];
	
	emeregency=false;		//блокировка помещения элементов в этот период (перед удалением)

	attachItemsStore(items) {
		if (this.items!==undefined) return;
		this.items=items;
	}

	/**
	 * Ищет среди загрузенных элементов те, которые нужно поместить в себя
	 */
	findItems(all=true) {
		if (this.items===undefined) {
			//console.log('items not attached. skip search')
			return;
		}
		//let current=this.countItems();
		this.itemsTypes.forEach(type=>{
			values(this.items[type].items)
				.forEach(item=>{					
					if (all || item.intervalId===null) 	//если мы подтягиваем все элементы или у этого элемента нет интервала, то 
						item.findInterval([this.id])	//предлагаем себя
				})
		})

		//console.log(this.id+': found '+(this.countItems()-current)+' '+(all?'all ':'orphaned ')+'items' );
	}

	/**
	 * перераспределить элементы интервала по периодам
	 */
	reperiodItems() {
		if (this.items === undefined) return;
		this.itemsTypes.forEach(type => {
			get(this.itemsIds.ids,type)
				.forEach(i => {
					get(this.items[type].items, i)
						.findPeriod(this.periodsIds)
				})
		})
	}

	/**
	 * перераспределить элементы интервала по интервалам (перед удалением или после смены границ)
	 */
	reintervalItems(search=null) {
		if (this.items === undefined) return;
		//let current=this.countItems();
		//console.log(this.id+': reintervaling from '+(current)+' items' );
		this.itemsTypes.forEach(type => {
			const ids=[...get(this.itemsIds.ids,type)];	//если не клонировать массив, то forEach по уменьшающемуся архиву ломается на середине
			//let counter=0;
			//console.log(this.id+': reintervaling '+(ids.length)+' of '+type);
			
				ids.forEach(i => {
					get(this.items[type].items, i)
						.findInterval(search);
					//counter++;
				})
			//console.log(this.id+': processed '+(counter)+' of '+type);
		})
		//let total=this.countItems();
		//console.log(this.id+': reintervaled to '+ total+'('+(total-current)+') items' );
	}


	/**
	 * Ну по смыслу это beforeDelete
	 * говорим что в нас нельзя ничего помещать и перераспределяем элементы
	 */
	beforeDelete(search=null) {
		this.emeregency=true;
		this.reintervalItems(search);
	}

    reinitPeriods() {
        //console.log(this.id+': interval periods reinit');
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
            let period=new PeriodItem(t,len,this);
            this.periods.setPeriod(period);
			this.periodsIds.push(t);
        }
		//console.log(this.items);
		this.reperiodItems();
	}

	init() {
		const start = this.time.weekStart(this.id);
		const end = this.id>this.time.weekMax?null:this.time.weekEnd(this.id);
		const today = this.time.today;
		//const oldStart = this.start;
		const oldEnd = this.end;

		if (this.start !== start || this.end !== end || this.today !== today) {
			//console.log (this.id + ': [' + this.start + ',' + this.end + ','+this.today+'] -> [' + start+',' + end + ','+today + ']' );
			this.start=start;
			this.end=end;
			this.today=today;
			this.reinitPeriods();	//большинство переедет в новый последний
			if (oldEnd===null && end!==null) { //был последним и перестал
				this.reintervalItems([this.id+1]);	//большинство переедет в новый последний
			} else {
				this.reintervalItems();
			}
			when(//нужно подождать что интервал не просто создался, но и добавился в список интервалов
				()=>has(this.periods.intervals,this.id),
				()=>{this.findItems(false)}				//перепроверяем свободные элементы
			);
		}
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

Object.assign(IntervalItem.prototype,PeriodItemsMixin);
export default IntervalItem;