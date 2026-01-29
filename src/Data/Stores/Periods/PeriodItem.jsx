import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import ItemsIdsStore from '../Items/ItemsIdsStore';
import PeriodItemsMixin from './PeriodItemsMixin';
import {action, makeObservable, observable} from 'mobx';

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
			className: observable
		})
    }
}

Object.assign(PeriodItem.prototype,PeriodItemsMixin);

export default PeriodItem;