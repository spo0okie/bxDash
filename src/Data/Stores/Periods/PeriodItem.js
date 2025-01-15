import 'reflect-metadata';
import TimeHelper from 'Helpers/TimeHelper';
import ItemsIdsStore from '../Items/ItemsIdsStore';
import PeriodItemsMixin from './PeriodItemsMixin';

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
        if (len===null) {
            this.type='week';
            this.title='Долгий ящик';
            this.dropTime=null;
        } else if (len<=TimeHelper.dayLen) {
            this.type='day';
            this.title=TimeHelper.strWeekDayDate(start);
            this.dropTime=this.start
                +TimeHelper.hourLen*18; //18-00
        } else {
            this.type='week';
            this.dropTime=this.start
                +TimeHelper.dayLen*4    //пятница (четыре полных суток с начала понедельника - конец четверга, начало пятницы)
                +TimeHelper.hourLen*18; //18-00
            this.title='Эта неделя'
            this.toolTip=TimeHelper.strDateHuman(start)+' - '+TimeHelper.strDateHuman(start+len);
            let week=Math.floor((this.time.monday0-start-1000)/TimeHelper.weekLen)+1;
            if (start < this.time.monday0) {
                week=Math.floor((this.time.monday0-start-1000)/TimeHelper.weekLen)+1;
                this.title = week===1?'Пред. неделя':week+' нед. назад';
            }
            if (start > this.time.sunday0) {
                week=Math.floor((start-this.time.sunday0)/TimeHelper.weekLen)+1;
                this.title = week===1?'След. неделя':'Через '+week+' нед.';
            }

			this.title+=' ('+TimeHelper.getWeek(this.start)+')';
        }

        this.className='period0';
        if (start < this.time.monday0) {
            let week=Math.floor((this.time.monday0-start-1)/TimeHelper.weekLen)+1;
            this.className='period'+Math.min(week,7);
        }
        if (start > this.time.sunday0-1) {
            let week=Math.floor((start-this.time.sunday0)/TimeHelper.weekLen)+1;
            this.className='period'+Math.min(week,7);
        }
        //console.log(time.today);
        this.isClosed=(start <= this.time.today);
        this.isOpen=(this.end > this.time.today || this.end===null);
        this.isToday=(this.isClosed && this.isOpen)

		this.itemsIds = new ItemsIdsStore(interval.itemsTypes);
    }
}

Object.assign(PeriodItem.prototype,PeriodItemsMixin);

export default PeriodItem;