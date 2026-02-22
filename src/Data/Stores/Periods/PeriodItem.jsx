import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import ItemsIdsStore from '../Items/ItemsIdsStore';
import PeriodItemsMixin from './PeriodItemsMixin';
import {action, makeObservable, observable, computed, get} from 'mobx';

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
	emeregency=false;		//блокировка помещения элементов в этот период (перед удалением)

	itemsIds;

	dragOverCell=null;
	setDragOverCell=(value)=>{
		//console.log(value);
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

        this.className='period0';
        if (this.start < this.time.monday0) {
            let week=Math.floor((this.time.monday0-this.start-1)/TimeHelper.weekLen)+1;
            this.className='period'+Math.min(week,7);
        }
        if (this.start > this.time.sunday0-1) {
            let week=Math.floor((this.start-this.time.sunday0)/TimeHelper.weekLen)+1;
            this.className='period'+Math.min(week,7);
        }
        //console.log(time.today);
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
		//console.log(this.startObj);
		//console.log(this.endObj);
		//console.log(this.wDays);

		this.timeInit();
		this.itemsIds = new ItemsIdsStore(interval.itemsTypes);

        makeObservable(this,{
			dragOverCell: observable,
			setDragOverCell: action,
			className: observable,
			// Computed-свойства для мемоизации фильтрации элементов
			closedTasks: computed,
			openedTasks: computed,
			closedJobs: computed,
			openedJobs: computed,
			closedTickets: computed,
			openedTickets: computed,
			plans: computed,
		})
    }

	// ==================== Computed-свойства для мемоизации фильтрации ====================

	/**
	 * Возвращает массив закрытых задач периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<TaskItem>} Массив закрытых задач
	 */
	get closedTasks() {
		const items = this.interval.items;
		if (!items) return [];
		const taskIds = get(this.itemsIds.ids, 'task') || [];
		return taskIds
			.map(id => get(items.task.items, id))
			.filter(task => task?.isClosed)
			.map(task => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void task.sorting;
				void task.t;
				return task;
			});
	}

	/**
	 * Возвращает массив открытых задач периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<TaskItem>} Массив открытых задач
	 */
	get openedTasks() {
		const items = this.interval.items;
		if (!items) return [];
		const taskIds = get(this.itemsIds.ids, 'task') || [];
		return taskIds
			.map(id => get(items.task.items, id))
			.filter(task => task && !task.isClosed)
			.map(task => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void task.sorting;
				void task.t;
				return task;
			});
	}

	/**
	 * Возвращает массив закрытых работ периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<JobItem>} Массив закрытых работ
	 */
	get closedJobs() {
		const items = this.interval.items;
		if (!items) return [];
		const jobIds = get(this.itemsIds.ids, 'job') || [];
		return jobIds
			.map(id => get(items.job.items, id))
			.filter(job => job?.isClosed)
			.map(job => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void job.sorting;
				void job.t;
				return job;
			});
	}

	/**
	 * Возвращает массив открытых работ периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<JobItem>} Массив открытых работ
	 */
	get openedJobs() {
		const items = this.interval.items;
		if (!items) return [];
		const jobIds = get(this.itemsIds.ids, 'job') || [];
		return jobIds
			.map(id => get(items.job.items, id))
			.filter(job => job && !job.isClosed)
			.map(job => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void job.sorting;
				void job.t;
				return job;
			});
	}

	/**
	 * Возвращает массив закрытых тикетов периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<TicketItem>} Массив закрытых тикетов
	 */
	get closedTickets() {
		const items = this.interval.items;
		if (!items) return [];
		const ticketIds = get(this.itemsIds.ids, 'ticket') || [];
		return ticketIds
			.map(id => get(items.ticket.items, id))
			.filter(ticket => ticket?.isClosed)
			.map(ticket => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void ticket.sorting;
				void ticket.t;
				return ticket;
			});
	}

	/**
	 * Возвращает массив открытых тикетов периода
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<TicketItem>} Массив открытых тикетов
	 */
	get openedTickets() {
		const items = this.interval.items;
		if (!items) return [];
		const ticketIds = get(this.itemsIds.ids, 'ticket') || [];
		return ticketIds
			.map(id => get(items.ticket.items, id))
			.filter(ticket => ticket && !ticket.isClosed)
			.map(ticket => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void ticket.sorting;
				void ticket.t;
				return ticket;
			});
	}

	/**
	 * Возвращает массив планов периода (без разделения на открытые/закрытые)
	 * Важно: читаем sorting и t для отслеживания изменений MobX-реактивностью
	 * @returns {Array<PlanItem>} Массив планов
	 */
	get plans() {
		const items = this.interval.items;
		if (!items) return [];
		const planIds = get(this.itemsIds.ids, 'plan') || [];
		return planIds
			.map(id => get(items.plan.items, id))
			.filter(plan => plan)
			.map(plan => {
				// "Трогаем" sorting и t, чтобы MobX отслеживал их изменения для реактивной сортировки
				void plan.sorting;
				void plan.t;
				return plan;
			});
	}

	// ==================== Вспомогательные методы ====================

	/**
	 * Логирование основных параметров периода
	 */
	logInfo() {
		const startStr = TimeHelper.strDateTime(this.start);
		const endStr = this.end ? TimeHelper.strDateTime(this.end) : 'null (bucket)';
		const lenStr = this.len ? `${this.len / TimeHelper.dayLen}d` : 'null';
		const itemCount = this.countItems ? this.countItems() : 0;

		console.log(
			`  [Period ${this.type}] ` +
			`start=${startStr}, ` +
			`end=${endStr}, ` +
			`len=${lenStr}, ` +
			`title="${this.title}", ` +
			`className=${this.className}, ` +
			`isOpen=${this.isOpen}, ` +
			`isClosed=${this.isClosed}, ` +
			`isToday=${this.isToday}, ` +
			`items=${itemCount}`
		);
	}
}

Object.assign(PeriodItem.prototype,PeriodItemsMixin);

export default PeriodItem;