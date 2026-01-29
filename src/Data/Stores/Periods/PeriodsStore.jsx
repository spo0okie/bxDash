import 'reflect-metadata';
import {observable,  values, set, has, get, keys, remove, action, makeAutoObservable, observe} from 'mobx';
import IntervalItem from './IntervalItem';

class PeriodsStore {
    @observable intervals = new observable.map();   //недели
    @observable periods = new observable.map();
	
	main;
	layout;
    time;
    items;
    expand; //внутреннее состояние expand под который построены периоды

	weeksInit(){
		const weeks=this.time.weeksRange(true);
		//ищем что нужно добавить
		weeks.reverse().forEach(id=>{
			if (has(this.intervals, id)) {
				//если такой элемент есть - обновляем его поля (поштучно)
				//console.log(id +' updatin');
				get(this.intervals,id).init(); 
			} else {
				//console.log(id +' creatin');
				set(this.intervals, id, new IntervalItem(id,this.main,this.time,this.items,this.layout,this));
			}
		});

		//проверяем что нужно удалить
		keys(this.intervals).forEach(id=>{
			if(!weeks.includes(id)){
				this.deleteInterval(id)

			}
		})
		//this.logStatus();
	}

	logStatus() {
		let status={};
		values(this.intervals).forEach(item=>{
			status[item.id]=item.countItems();
		})
		console.log(status);
	}

	@action setPeriod(period) {
		set(this.periods,period.start,period);
	}

	@action deletePeriod(id) {
		remove(this.periods,id);
	}

	@action deleteInterval(id) {
		console.log(id +' deletin');
		get(this.intervals,id).beforeDelete();
		remove(this.intervals,id);
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

        observe(time,'weekMin',change=>{this.weeksInit()});
        observe(time,'weekMax',change=>{this.weeksInit()});
        observe(time,'today',change=>{this.weeksInit()});

        makeAutoObservable(this);
    }

}

export default PeriodsStore;