import {values} from 'mobx';
import TimeHelper from './TimeHelper';

/**
 * проверка пересечения интервалов
 * @param interval1 array
 * @param interval2 array
 * @param boolean neighbours
 * @return boolean
 */
function intervalsIntersect(interval1,interval2,neighbours=false)
{
	// сортируем интервалы так, чтобы второй был не раньше первого
	if (interval2[0]<interval1[0]) {
		let tmp=interval1;
		interval1=interval2;
		interval2=tmp;
	}

	//далее у нас точно интервал 1 начинается не позже 2го (одновременно или раньше)
	//значит если второй начинается раньше чем первый заканчивается => они пересекаются
	return neighbours?
		(interval2[0]-1)<=interval1[1]
		:
		interval2[0]<interval1[1];
}

/**
 * сложение интервалов. проверка на то что они пересекаются не делается
 * @param interval1 array
 * @param interval2 array
 * @return array
 */
function intervalsAddition(interval1,interval2)
{
    return [
        Math.min(interval1[0],interval2[0]),
        Math.max(interval1[1],interval2[1]),
    ];
}

/**
 * Сравнивает интервалы
 * @param interval1
 * @param interval2
 * @return int 1 - первый позже, -1 - первый раньше, 0 - начинаются одновременно
 */
function intervalsCompare(interval1,interval2)
{
    if (interval1[0]===interval2[0]) return 0;
    return  (interval1[0] > interval2[0])?1:-1;
}

function intervalsSort(intervals)
{
    intervals.sort(intervalsCompare)
}

/**
 * Возвращает отсутствия конкретного пользотваля из общего списка
 * @param {*} list 
 * @param {*} userId 
 * @returns 
 */
function getUserAbsents(list,user) {
	return [...values(list.items)].filter((item)=>item.user===user);
}

/**
 * Возвращает отсутствия пользователя в периоде в виде массива градиента периодов и подсказки-пояснения
 * @param start
 * @param end
 * @param user
 * @return Map
 */
function userPeriodAbsentsGradient(list,start,end,user) {
    
	//если на пользователя нет отсутствий, то
    const empty= {background:'none',title:''};

	if (!end) {end=start+86400*7*1000;}
	start=start+6*3600*1000;	//рабочий день группы начинается в 6
	end=end-(24-18)*3600*1000;	//рабочий день группы заканчитвается в 18
    
	//console.log('userPeriodAbsents('+start+','+end+','+user+')');
	const userAbsents=getUserAbsents(list,user);
    if (!userAbsents.length) {
        //console.log('no absents loaded for user '+user);
        return empty;
    }

    //иначе работаем
    const busy='rgba(255,140,0,0.7)';
    const avail='transparent';

    //округляем начало и конец до дней
    //let start_day=Math.floor((start)/86400/1000);
    //let end_day=Math.floor((end-1)/86400/1000);
    
	let periods=[]; //периоды отсутствия сотрудника в указанном интервале времени
    let titles=[]; //TTIP который будет показывать список отсутствий пользователя

    // перебор по элементам в формате [ключ, значение]
    for (let item of userAbsents) {
        
		//console.log(item[1]);
        let from=item.createdAt;
        let to=item.closedDate;
		console.log(from,to);
        //console.log('Checking for absent ['+from+','+to+'] to intersect ['+work_start+','+work_end+']    //    ' +
        //'['+unixTimeToMyDate(from*86400000)+','+unixTimeToMyDate(to*86400000)+'] intersect with ['+unixTimeToMyDate(work_start*86400000)+','+unixTimeToMyDate(work_end*86400000)+']');

        if (from>end) continue; //все что началось позже обозримого периода не интересно
        if (to<start) continue; //все что закончилось раньше нашего периода - тоже

        //если полностью покрывает обозримый период
        if (from<=start && to>=end) {
            //console.log('full period absent for user '+user);
            return {
				background:busy,
				title:'Полностью отсутствует '+TimeHelper.strDateHumanLong(from)+' - '+TimeHelper.strDateHumanLong(to)
			};
        }

        //ограничиваем рассматриваемый элемент границами периода на который составляем расписание
        if (from <= start) from=start;
        if (to >= end) to = end;

        //объявляем интервал
        let interval=[from,to];

        //добавляем его в TTIP
        titles.push(TimeHelper.strDateHumanLong(from)+' - '+TimeHelper.strDateHumanLong(to));

        //объединяем с соседними и пересекающимися интервалами
        if (periods.length) {
            for (let i=0; i<periods.length; i++ ){
                if (intervalsIntersect(periods[i],interval,true)) {
                    //если пересекся с уже обнаруженным периодом - то период сливаем с текущим интервалом
                    interval=intervalsAddition(periods[i],interval);
                    if (periods.length >1 ) {
                        periods.slice(i,1);
                        i--;
                    } else
                        periods=[];
                }
            }
        }

        //кладем в общую кучку периодов отсутствия
        periods.push(interval);
    }

    if (!periods.length) {
        //console.log('no absents found in period for user '+user);
        return empty;
    }

    intervalsSort(periods);

    //к этому моменту мы имеем отсортированный массив непересекающихся и не соприкасающихся интервалов

    let prevPos=null;
    let css=[];
    for (let i=0; i<periods.length; i++ ){
        let period=periods[i];
        let cssStart=Math.round(100*(period[0]-start)/(end-start));
        let cssEnd=Math.round(100*(period[1]-start)/(end-start));
        if (prevPos!==null) {
            css.push(avail+' '+prevPos+'%');
            css.push(avail+' '+cssStart+'%');
        } else if (cssStart) {
            css.push(avail+' 0%');
            css.push(avail+' '+cssStart+'%');
        }
        css.push(busy+' '+cssStart+'%');
        css.push(busy+' '+cssEnd+'%');
        prevPos=cssEnd;
    }

    let style;
    if (prevPos!==null){
        if (prevPos<100) {
            css.push(avail+' '+prevPos+'%');
            css.push(avail+' 100%');
        }
        style='linear-gradient( to bottom, '+css.join(', ')+')';
        //console.log(periods);
        //console.log(titles);
        //console.log(style);
    } else {
        style=null;
    }

    return {
		background:style,
		title:'Отсутствует '+titles.join(', ')
	};
}



function userAbsentsStatus(list,user) {
    let absents=getUserAbsents(list,user);

	//console.log(absents);
	let daysToAbsence=Infinity;
    let actualAbsence='';

	let today=TimeHelper.getToday();

	//ищем отсутствия пользователя
    for (let item of absents) {
        //console.log(item[1]);
        let to=item.closedDate;
		let from=item.createdAt;
        if (to>=today) {
            //если мы еще не отсутствуем (0)
            if (daysToAbsence) {
                //суток до отпуска/отсутствия
				//let days=
                let daysToItem=Math.round(Math.max(from-today, 0)/86400/1000);
                if (daysToItem < daysToAbsence) {
                    daysToAbsence=daysToItem;
                    actualAbsence=TimeHelper.strDateHumanLong(from)+' - '+TimeHelper.strDateHumanLong(to);
                }
            }
        } //else console.log ()
    }

	return {
		days:daysToAbsence,
		title:daysToAbsence?
			daysToAbsence+" дн до следующего отсутствия ("+actualAbsence+")":
			"Отсутствует ("+actualAbsence+")"
	}
}

export {
	userAbsentsStatus,
	userPeriodAbsentsGradient
};