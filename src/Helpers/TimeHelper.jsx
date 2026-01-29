/*
Задача класса выдавать результаты все время в одном часовом поясе
*/
class TimeHelper {
	tz='Europe/Moscow';		//нигде не используется, просто памятка
	tzOffest=3*3600*1000;	//смещение нужного нам часового пояса в мкс относительно UTC
	tzHoursOffset=3;		//смещение нужного нам часового пояса в часах относительно UTC
	tsStrOffset='+03:00';	//смещение нужного нам часового пояса относительно UTC в текстовом виде

	weekLen=7*24*3600*1000;	//неделя в мкс
	dayLen=24*3600*1000;	//сутки в мкс
	hourLen=3600*1000;		//час в мкс
	minLen=60*1000;			//минута в мкс

	wDays=['пн','вт','ср','чт','пт','сб','вс'];
	
	//возвращает дату/время, которая по запросам getUTC* будет отдавать данные в московском часовом поясе
	getTime() {
		//украдено https://stackoverflow.com/a/10088053
    	// create Date object for current location
    	let d = new Date();
   
    	// get UTC time in msec
    	let utc = d.getTime();
   
    	// create new Date object for different city
    	// using supplied offset
		return new Date(utc+this.tzOffest);
	}

	//возвращает дату-время начала сегодняшнего (по МСК) дня
	getToday() {
		let d = new Date();
		d.setUTCHours(-this.tzHoursOffset,0,0,0);
		return d;
	}

	getTimestamp() {
		const d = new Date();
		return d.getTime();
	}

	getUnixtime() {
		const d = new Date();
    	return Math.floor(d.getTime()/1000);
	}


	//конверитирует разницу в мкс в вид [1d 23h 57m 11s]
	strDiff(diff) {
		let output='';

		if (diff > this.dayLen) {
			let days=Math.floor(diff/this.dayLen);
			diff-=days*this.dayLen;
			output+=days+'d ';
		}

		if (diff > this.hourLen) {
			let hours=Math.floor(diff/this.hourLen);
			diff-=hours*this.hourLen;
			output+=hours+'h ';
		}

		if (diff > this.minLen) {
			let min=Math.floor(diff/this.minLen);
			diff-=min*this.minLen;
			output+=min+'m ';
		}

		let sec=Math.floor(diff/1000);
		output+=sec+'s';

		return output;
	}

	objDate(time) {
		let t=new Date(time+this.tzOffest);
		let W=t.getUTCDay();	//по умолчанию 0 - вскр, 6 -суббота
		W--;                //сдвигаем в диапазон [-1 - вс; 0..5 - пн..сб]
		if (W<0) W=6;       //теперь это диапазон [0..6 => пн..вс]

		let Y=t.getUTCFullYear();
		let y=Y % 100;
		return {
			h:t.getUTCHours(),
			m:t.getMinutes(),
			s:t.getSeconds(),
	
			D:t.getUTCDate(),
			M:t.getUTCMonth()+1,	//месяц по умолчанию начинается с ноля, нам это неудобно
			
			Y:Y,
			y:y,
			
			W:W,					//номер дня недели
			w:this.wDays[W],		//короткий текст дня недели
		}
	}

	zeroPad(num) {
		if (num<10) return '0'+num;
		return num;
	}

	//YYYY-MM-DD
	strDate(time) {
		let t=this.objDate(time);
		return time=t.Y+'-'+this.zeroPad(t.M)+'-'+this.zeroPad(t.D);  
	}

	//MM.DD.YY
	strDateHuman(time) {
		let t=this.objDate(time);
		return time=this.zeroPad(t.D)+'.'+this.zeroPad(t.M)+'.'+String(t.Y).substring(2);
	}

	//MM.DD.YYYY (ww)
	strDateHumanLong(time) {
		let t=this.objDate(time);
		return time=this.zeroPad(t.D)+'.'+this.zeroPad(t.M)+'.'+t.Y+'('+t.w+')';
	}

	//MM.DD.YYYY (ww) hh:mm
	strDateTimeHumanLong(time) {
		let t=this.objDate(time);
		return time=this.zeroPad(t.D)+'.'+this.zeroPad(t.M)+'.'+t.Y+'('+t.w+') '+this.zeroPad(t.h)+':'+this.zeroPad(t.m);
	}

	shortDate(time) {
		let t=this.objDate(time);
		return this.zeroPad(t.D)+'.'+this.zeroPad(t.M);  
	}

	strWeekDayDate(time) {
		let t=this.objDate(time);
		return time=this.zeroPad(t.D)+'.'+this.zeroPad(t.M) +' ('+t.w+')';  
	}

	strDateTime(time) {
		let t=this.objDate(time);
		return time=t.Y+'-'+this.zeroPad(t.M)+'-'+this.zeroPad(t.D)+' '+this.zeroPad(t.h)+':'+this.zeroPad(t.m)+':'+this.zeroPad(t.s);  
	}


	//приводит текстовую запись даты-времени в формате Битрикса к формату JS
	bitrixDateTimeToJs(time) {
    	if (typeof time !== 'string') return null;
    	let $tokens=time.split(' ');
    	let $newDate=$tokens[0].split('.').reverse().join('-');
    	if ($tokens.length===2) {
        	return Date.parse($newDate+'T'+$tokens[1]+this.tsStrOffset);
    	} else {
        	return Date.parse($newDate+'T00:00:00'+this.tsStrOffset);
    	}
	}

	getWeek(time) {
		var date = new Date(time);
		date.setHours(0, 0, 0, 0);
		// Thursday in current week decides the year.
		date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
		// January 4 is always in week 1.
		var week1 = new Date(date.getFullYear(), 0, 4);
		// Adjust to Thursday in week 1 and count number of weeks from date to week1.
		return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
			- 3 + (week1.getDay() + 6) % 7) / 7);
	}

}

export default TimeHelper=new TimeHelper();