import 'reflect-metadata';
import {observable, action, makeAutoObservable} from 'mobx';
import TimeHelper from 'Helpers/TimeHelper';

class TimeStore {

	main;

    @observable weekMin=-4;               //сколько недель перед этой отображается
    @observable weekMax=4;                //сколько недель после этой отображается

    @observable strTime = 'uninitialized';  //время в формате чч:мм:сс (пока только для отладки)
    @observable hours   = '??';             //текущее МСК время (часы)
    @observable minutes = '??';             //текущее МСК время (мин)
    @observable seconds = '??';             //текущее МСК время (сек)
    @observable day     = '??';             //текущее МСК время (число месяца)
    @observable month   = '??';             //текущее МСК время (месяц)
    @observable year    = '??';             //текущее МСК время (год)
    @observable wday    = '??';             //текущее МСК время (день недели)

    @observable monday0 = null;
    @observable sunday0 = null;
    @observable today = null;

    TimeHelper;

    @action updateTime() {
        let now=TimeHelper.getTime();

        let h=this.hours    =now.getUTCHours();
        let m=this.minutes  =now.getMinutes();
        let s=this.hours    =now.getSeconds();

        let d=now.getUTCDate();
        let M=this.month;
        let Y=this.year;
        let w=this.wday;
        let d0=this.today;
        let m0=this.monday0;
        let s0=this.sunday0;

        if (d !== this.day) {
            this.day=d;
            M=this.month    =now.getUTCMonth()+1;
            Y=this.year     =now.getUTCFullYear();    
            
            w=now.getUTCDay();  //по умолчанию 0 - вскр, 6 -суббота
            w--;                //сдвигаем в диапазон [-1 - вс; 0..5 - пн..сб]
            if (w<0) w=6;       //теперь это диапазон [0..6 => пн..вс]
            this.wday=w;

            d0=this.today   =TimeHelper.getToday().getTime();
            m0=this.monday0 =d0 -w*24*3600*1000;
            s0=this.sunday0 =d0 +(7-w)*24*3600*1000;
            console.log('timeStore: today ['+d0+'] :'+TimeHelper.strDateTime(d0))
            console.log('timeStore: monday0 ['+m0+'] :'+TimeHelper.strDateTime(m0))
            console.log('timeStore: sunday0 ['+s0+'] :'+TimeHelper.strDateTime(s0))
        }

        let time=h+':'+m+':'+s;
        let date=Y+'-'+M+'-'+d;
        this.strTime=time+' '+date;
		//console.log(d+' vs '+this.day+'  '+TimeHelper.strDateTimeHumanLong(d0)+' '+this.strTime);

        //console.log(date+' ('+w+') '+time);
        /*
        //проверка корректности определения начала и конца недели
        let x=new Date();
        console.log(this.time.strDiff(x.getTime()-d0.getTime())+' since day start');
        console.log(this.time.strDiff(x.getTime()-m0.getTime())+' since week start');
        console.log(this.time.strDiff(s0.getTime()-x.getTime())+' before week end');
        /**/
    }

    loadOption(name) {return this.main.loadOption('time.'+name);}
    saveOption(name,value) {return this.main.saveOption('time.'+name,value,);}

    weekStart(id) {
        return this.monday0 + TimeHelper.weekLen * id;
    }

    weekEnd(id) {
        return this.sunday0 + TimeHelper.weekLen * id;
    }

    firstWeekStart() {
        return this.weekStart(this.weekMin);
    }

    lastWeekEnd() {
        return this.weekEnd(this.weekMax);
    }

	@action setWeekMin(value) {
		if (value===this.weekMin) return;
		this.weekMin=value;
		this.saveOption('weekMin',value)
	}

	@action setWeekMax(value) {
		if (value===this.weekMax) return;
		this.weekMax=value;
		this.saveOption('weekMax',value)
	}

	decWeekMin() {
		this.setWeekMin(this.weekMin-1);
	}

	incWeekMin() {
		if (this.weekMin>=0) return;
		this.setWeekMin(this.weekMin+1);
	}

	decWeekMax() {
		if (this.weekMax<=0) return;
		this.setWeekMax(this.weekMax-1);
	}

	incWeekMax() {
		this.setWeekMax(this.weekMax+1);
	}

    weeksRange(bucket=false) {
        let range = [];
		let max = this.weekMax;
		if (bucket) max++;
		for (let i = this.weekMin; i <= max; i++) {
            range.push(i);
        }
        return range;
    }

    constructor(main) {
		this.main=main;
        this.weekMax=this.loadOption('weekMax') ?? 4;
        this.weekMin=this.loadOption('weekMin') ?? -4;
        this.updateTime();
        makeAutoObservable(this);

        setInterval(() => {
            this.updateTime();
        },1000);    

    }

}

export default TimeStore;