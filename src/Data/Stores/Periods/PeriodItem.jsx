import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import PeriodItemsMixin from './PeriodItemsMixin';
import {action, makeObservable, observable, computed, values} from 'mobx';

class PeriodItem {
    time;       //ссылка на объект - хранилище времени

	start;      //начало периода
    len;        //длина
    end;        //конец периода

	dropTime;   //какое время ставить элементам брошенным на этот период (на день ставим 18-00 МСК, на неделю ставим 18-00 пятницы, долгий ящик - null)
    type;       //тип ['week'|'day']

	className;  //класс раскраски (количество недель от этой)

    isOpen;     //содержит открытые элементы
    isClosed;   //содержит закрытые элементы
    isToday;    //содержит и те и эти (такое бывает только сегодня/на этой неделе)

	interval;	//внутри какого интервала период

	dragOverCell=null;
	setDragOverCell=(value)=>{
		if (this.dragOverCell!==value) this.dragOverCell=value;
	}

	timeInit=()=>{
        if (this.len===null) {
            this.type='week';
            this.title='Долгий ящик';
            this.dropTime=null;
			this.toolTip='Будущие элементы не вместившиеся в календарь';
        } else if (this.len<=TimeHelper.dayLen) {
            this.type='day';
            this.title=TimeHelper.strWeekDayDate(this.start);
            this.dropTime=this.start
                +TimeHelper.hourLen*18; //18-00
			this.toolTip=TimeHelper.strDateHumanLong(this.start);
		} else {
            this.type='week';
            this.dropTime=this.start
                +TimeHelper.dayLen*4    //пятница (четыре полных суток с начала понедельника - конец четверга, начало пятницы)
                +TimeHelper.hourLen*18; //18-00
            this.title='Эта неделя'
            this.toolTip=TimeHelper.strDateHuman(this.start)+' - '+TimeHelper.strDateHuman(this.start+this.len);
            let week=Math.floor((this.time.monday0-this.start-1000)/TimeHelper.weekLen)+1;
            if (this.start < this.time.monday0) {
                week=Math.floor((this.time.monday0-this.start-1000)/TimeHelper.weekLen)+1;
                this.title = week===1?'Пред. неделя':week+' нед. назад';
            }
            if (this.start > this.time.sunday0-1000) {
                week=Math.floor((this.start-this.time.sunday0+1000)/TimeHelper.weekLen)+1;
                this.title = week===1?'След. неделя':'Через '+week+' нед.';
            }

			this.title+=' ('+TimeHelper.getWeek(this.start)+')';
        }

        this.className=0;
        if (this.start < this.time.monday0) {
            let week=Math.floor((this.time.monday0-this.start-1)/TimeHelper.weekLen)+1;
            this.className=Math.min(week,7);
        }
        if (this.start > this.time.sunday0-1) {
            let week=Math.floor((this.start-this.time.sunday0)/TimeHelper.weekLen)+1;
            this.className=Math.min(week,7);
        }
        this.isClosed=(this.start <= this.time.today);
        this.isOpen=(this.end > this.time.today || this.end===null);
        this.isToday=(this.isClosed && this.isOpen)
	}

    constructor(start,len,interval) {
		this.interval=interval;
        this.time=interval.time;
        this.start=start;
        this.len=len;
        this.end=len===null?null:start+len;
		this.startObj = TimeHelper.objDate(this.start);
		this.endObj = this.end?TimeHelper.objDate(this.end-1):null;
		this.wDays=[];
		if (this.endObj) for (let i = this.startObj.W; i <= this.endObj.W; i++) this.wDays.push(i);

		this.timeInit();

        makeObservable(this,{
			dragOverCell: observable,
			setDragOverCell: action,
			className: observable,
			closedTasks: computed,
			openedTasks: computed,
			closedJobs: computed,
			openedJobs: computed,
			closedTickets: computed,
			openedTickets: computed,
			plans: computed,
			itemsByUser: computed,
		})
    }

	// ==================== Декларативная фильтрация элементов ====================

	/**
	 * Параметризованная выборка элементов периода: по типу и предикату.
	 * Декларативный путь — берём весь items[type].items и фильтруем через filterItem
	 * (предикат периода по t) + клиентский предикат (open/closed).
	 *
	 * "Трогаем" sorting — явная зависимость для реактивной сортировки внутри ячейки;
	 * filterItem уже читает item.t (зависимость от смены даты).
	 */
	_pick(type, predicate) {
		const items = this.interval.items;
		if (!items) return [];
		const store = items[type];
		if (!store) return [];
		const out = [];
		values(store.items).forEach(item => {
			if (!this.filterItem(item)) return;
			if (!predicate(item)) return;
			void item.sorting;
			out.push(item);
		});
		return out;
	}

	get closedTasks()   { return this._pick('task',   i => i.isClosed); }
	get openedTasks()   { return this._pick('task',   i => !i.isClosed); }
	get closedJobs()    { return this._pick('job',    i => i.isClosed); }
	get openedJobs()    { return this._pick('job',    i => !i.isClosed); }
	get closedTickets() { return this._pick('ticket', i => i.isClosed); }
	get openedTickets() { return this._pick('ticket', i => !i.isClosed); }
	/** Планы — без разделения на open/closed, рисуются всегда. */
	get plans()         { return this._pick('plan',   () => true); }

	/**
	 * Индекс элементов периода по userId.
	 *
	 * Один проход на период вместо отдельной фильтрации на каждую UserCell.
	 * Учитывает layout.accomplicesVisible: при включённом флаге задача
	 * попадает в ячейки всех соисполнителей, а не только ответственного.
	 *
	 * Для job/ticket/plan accomplices не применяется — только по responsible.
	 */
	get itemsByUser() {
		const accomplicesVisible = this.interval.layout.accomplicesVisible;
		const map = new Map();
		const ensure = uid => {
			let v = map.get(uid);
			if (!v) {
				v = {
					closedTasks: [], openedTasks: [],
					closedJobs: [], openedJobs: [],
					closedTickets: [], openedTickets: [],
					plans: [],
				};
				map.set(uid, v);
			}
			return v;
		};

		const placeTask = (task, bucket) => {
			ensure(task.user)[bucket].push(task);
			if (!accomplicesVisible) return;
			(task.accomplices ?? []).forEach(a => {
				if (a !== task.user) ensure(a)[bucket].push(task);
			});
		};

		this.openedTasks.forEach(t => placeTask(t, 'openedTasks'));
		this.closedTasks.forEach(t => placeTask(t, 'closedTasks'));
		this.openedJobs.forEach(j => ensure(j.user).openedJobs.push(j));
		this.closedJobs.forEach(j => ensure(j.user).closedJobs.push(j));
		this.openedTickets.forEach(tk => ensure(tk.user).openedTickets.push(tk));
		this.closedTickets.forEach(tk => ensure(tk.user).closedTickets.push(tk));
		this.plans.forEach(p => ensure(p.user).plans.push(p));

		return map;
	}

	/** Дефолтный набор пустых массивов для пользователя без элементов в периоде. */
	static EMPTY_USER_ITEMS = Object.freeze({
		closedTasks: [], openedTasks: [],
		closedJobs: [], openedJobs: [],
		closedTickets: [], openedTickets: [],
		plans: [],
	});

	// ==================== Вспомогательные методы ====================

	/** Логирование основных параметров периода (без счётчика — он стоит дороже теперь). */
	logInfo() {
		const startStr = TimeHelper.strDateTime(this.start);
		const endStr = this.end ? TimeHelper.strDateTime(this.end) : 'null (bucket)';
		const lenStr = this.len ? `${this.len / TimeHelper.dayLen}d` : 'null';
		console.log(
			`  [Period ${this.type}] ` +
			`start=${startStr}, end=${endStr}, len=${lenStr}, ` +
			`title="${this.title}", className=${this.className}, ` +
			`isOpen=${this.isOpen}, isClosed=${this.isClosed}, isToday=${this.isToday}`
		);
	}
}

Object.assign(PeriodItem.prototype,PeriodItemsMixin);

export default PeriodItem;
