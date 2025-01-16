import { action, makeObservable, observable } from "mobx";
import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";
import { act } from "react";

class TaskItem extends DashItem {

	initDefaults() {
		this.type = 'task';		//тип
		this.updatesCount = 0;	//количество обновлений в задаче
		this.accomplices = [];	//соисполнители
		this.title = "Заголовок задачи\nОписание задачи";
		this.defaultTitle = "Заголовок задачи\nОписание задачи";
		this.status = 1; 		//новая
	}

	recalcTime() {
		const t = this.t;

		this.isClosed = Boolean(this.closedDate) && (this.status === 5 || this.status === 7); //завершена, отменена
		this.isNow = (this.status === 3 || this.status === 4);                                //в работе, ждет подтверж. - всегда выполняются [прямо сейчас]!
		
		if (this.isClosed) {
			this.t = this.closedDate;
		} else if (this.isNow) {
			this.t = this.context.time.today;
		} else {
			this.t = this.deadline ? Math.max(this.deadline, this.context.time.today) : null;
		}

		if (this.deadline) {
			this.deadlineObj = TimeHelper.objDate(this.deadline);
			this.deadlineStr = this.deadlineObj.D + '.' + this.deadlineObj.M;
			if (this.context.time.year !== this.deadlineObj.Y)
				this.deadlineStr += '.' + this.deadlineObj.y;
		} else this.deadlineStr = 'нет срока';

		if (this.closedDate) {
			this.closedDateObj = TimeHelper.objDate(this.closedDate);
			this.closedDateStr = this.closedDateObj.D + '.' + this.closedDateObj.M;
			if (this.context.time.year !== this.closedDateObj.Y)
				this.closedDateStr += '.' + this.closedDateObj.y;
		} else this.closedDateStr = '';


		if (this.t !== t) this.findInterval();
	}

	setStatus(value) {
		if (value===this.status) return;
		this.status=value;
	}

	setUpdates(value) {
		if (value===this.updatesCount) return;
		this.updatesCount=value;
	}
	
	/**
	 * Инициализация на данных из Birtix
	 * @param {*} item 
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item,recalc){
        //console.log(item)
        if (!super.loadData(item)) return false;

		this.parentUids = item.PARENT_ID ? ['task:'+Number(item.PARENT_ID)]:[];

		this.title=item['~TITLE'];

        this.user=Number(item.RESPONSIBLE_ID);
        this.accomplices=item.ACCOMPLICES?item.ACCOMPLICES.map(i=>Number(i)):[];

        this.setStatus(Number(item.REAL_STATUS));
		
		switch (this.status) {
            case -1:    this.strStatus="Просрочена";	break;		//просрочена
            case 1:     this.strStatus="Новая";  		break;
            case 2:     this.strStatus="Ожидание"; 		break;	//Ожидание
            case 3:     this.strStatus="В работе"; 		break;
            case 4:     this.strStatus="Ож. подтв.";  	break;
            case 5:     this.strStatus="Завершена";  	break;
            case 6:     this.strStatus="Отложена";  	break;
            case 7:     this.strStatus="Отменена";  	break;
			default:	this.strStatus="unknown";
        }

        this.setUpdates(Number(item.UPDATES_COUNT));

        this.deadline=item.DEADLINE?TimeHelper.bitrixDateTimeToJs(item.DEADLINE):null;
		
		this.createdAt=TimeHelper.bitrixDateTimeToJs(item.CREATED_DATE);

        this.closedDate=TimeHelper.bitrixDateTimeToJs(item.CLOSED_DATE);


		const defaultSorting = Math.floor(this.createdAt / 1000);
		this.sorting = item.XML_ID ? Number(item.XML_ID) : defaultSorting;
		if (isNaN(this.sorting) || this.sorting>this.maxSort) {
			this.sorting = defaultSorting;
		}

		this.priority=Number(item.PRIORITY);

        this.favorite=item.FAVORITE==='Y';

		this.viewUrl='/company/personal/user/'+this.user+'/tasks/task/view/'+this.id+'/';

		if (recalc) this.recalcTime();
		this.setUpdating(false);
		return true;
	}

	changeStatus(newStatus) {
		if (newStatus===3 && !window.confirm("Начать выполнение задачи "+this.id+"?")) return false;
		if (newStatus===2 && !window.confirm("Остановить выполнение задачи "+this.id+"?")) return false;
		this.update({status:newStatus},true);
	}
	
	constructor(item,data,list) {
		super(item,data,list);
	
		makeObservable(this,{
			status:observable,
			updatesCount:observable,
			setStatus:action,
			setUpdates:action,
		})
	
			//console.log(this);
	}
}
export default TaskItem;