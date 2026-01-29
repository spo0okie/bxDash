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
		console.log('=== weeksInit start ===');
		console.log(`time.today=${this.time.today} (${new Date(this.time.today).toISOString()})`);
		console.log(`time.monday0=${this.time.monday0} (${new Date(this.time.monday0).toISOString()})`);
		console.log(`time.sunday0=${this.time.sunday0} (${new Date(this.time.sunday0).toISOString()})`);
		console.log(`time.weekMin=${this.time.weekMin}, time.weekMax=${this.time.weekMax}`);

		const weeks=this.time.weeksRange(true);
		console.log(`weeksRange=${JSON.stringify(weeks)}`);

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

		// Логирование всех интервалов и периодов
		console.log('=== Intervals and Periods ===');
		values(this.intervals).forEach(interval => {
			interval.logInfo();
			// Логирование периодов этого интервала
			interval.periodsIds.forEach(periodStart => {
				const period = get(this.periods, periodStart);
				if (period) {
					period.logInfo();
				}
			});
		});
		console.log('=== weeksInit end ===');
		//this.logStatus();
	}

	reintervalAllItems() {
		if (!this.items) return;
		this.items.types.forEach(type => {
			values(this.items[type].items).forEach(item => {
				item.findInterval();
			});
		});
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
        observe(time,'today',change=>{
			this.weeksInit();
			this.reintervalAllItems();  // <-- добавить
		});

        makeAutoObservable(this);
    }

}

export default PeriodsStore;