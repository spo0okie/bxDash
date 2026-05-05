import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import PeriodItem from './PeriodItem';
import {observe} from 'mobx';
import PeriodItemsMixin from './PeriodItemsMixin';

/**
 * Интервал — недельный контейнер периодов (или bucket с end===null).
 *
 * После Этапа 8 интервал больше НЕ владеет элементами через двусторонние ссылки.
 * `items` — это просто геттер на `periods.items` (общее хранилище), а PeriodItem
 * сам декларативно фильтрует элементы по своему диапазону.
 */
class IntervalItem {
    time;       //ссылка на хранилище времени
	periods;	//ссылка на хранилище периодов
	layout;		//ссылка на раскладку

	id;			//номер недели
    start;      //начало недели
    end;        //конец периода
	expand;		//внутреннее состояние expand под который построены периоды
	today;		//отметка "сегодня" относительно которой опредлены флаги открытого/закрытого периода

	itemsTypes;
	periodsIds=[];

	/** Все items берутся через корневое хранилище (см. ItemsMultiStore). */
	get items() { return this.periods.items; }

    reinitPeriods() {
        this.expand=this.layout.expand;

        let len=this.layout.expand?TimeHelper.dayLen:TimeHelper.weekLen;

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
	}

	init() {
		const start = this.time.weekStart(this.id);
		const end = this.id>this.time.weekMax?null:this.time.weekEnd(this.id);
		const today = this.time.today;

		if (this.start !== start || this.end !== end || this.today !== today) {
			this.start=start;
			this.end=end;
			this.today=today;
			this.reinitPeriods();
		}
	}

	/** Удаление интервала — освобождаем его периоды; элементы переедут сами через computed. */
	destroy() {
		this.periodsIds.forEach(t => this.periods.deletePeriod(t));
		this.periodsIds = [];
	}

    constructor(id,main,time,layout,periods) {
        this.id=id;
        this.time=time;
        this.layout=layout;
        this.periods=periods;
		this.itemsTypes=main.itemsTypes;
		this.init();
		observe(layout,'expand',()=>{if (this.layout.expand !== this.expand) this.reinitPeriods()});
    }

	logInfo() {
		const startStr = this.start ? TimeHelper.strDateTime(this.start) : 'null';
		const endStr = this.end ? TimeHelper.strDateTime(this.end) : 'null (bucket)';
		const todayStr = this.today ? TimeHelper.strDateTime(this.today) : 'null';
		const periodCount = this.periodsIds ? this.periodsIds.length : 0;

		console.log(
			`[Interval ${this.id}] ` +
			`start=${startStr}, end=${endStr}, today=${todayStr}, ` +
			`expand=${this.expand}, periods=${periodCount}`
		);
	}
}

Object.assign(IntervalItem.prototype,PeriodItemsMixin);
export default IntervalItem;
