import 'reflect-metadata';
import {observable,  values, set, has, get, remove, action, makeAutoObservable} from 'mobx';
import WeekItem from './WeekItem';

class PeriodsStore {
    @observable intervals = new observable.map();   //недели
    @observable periods = new observable.map();
	
	main;
	layout;
    time;
    items;
    expand; //внутреннее состояние expand под который построены периоды

	@action weeksInit(){
		this.time.weeksRange(true).forEach(id=>{
			if (has(this.intervals, id)) {
				//если такой элемент есть - обновляем его поля (поштучно)
				get(this.intervals,id).init(); 
			} else {
				set(this.intervals, id, new WeekItem(id,this.main,this.time,this.items,this.layout,this));
			}
		});
	}

	@action setPeriod(period) {
		set(this.periods,period.start,period);
	}

	@action deletePeriod(id) {
		remove(this.periods,id);
	}

	attachItemsStore(items) {
		this.items=items;
		values(this.intervals).forEach(interval => interval.attachItemsStore(items));
		
	}

    constructor(main,layout,time) {
        console.log('periodStore init');
		this.main = main;
        this.layout = layout;
        this.time = time;
        //this.intervals = observable.map();
        this.weeksInit()

        //observe(layout,'expand',change=>{this.refill()});

        makeAutoObservable(this);
    }

}

export default PeriodsStore;