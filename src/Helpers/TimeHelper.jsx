/*
Задача класса выдавать результаты в выбранном TimeStore часовом поясе.
Сам режим TZ хранится в TimeStore.tzMode, инжектится через setStore().
До инжекта (например, в самом раннем bootstrap) — fallback на MSK +3.
*/
class TimeHelper {
	tz = "Europe/Moscow"; //нигде не используется, просто памятка

	/** Фиксированный MSK-сдвиг для интеропа с бэкендом — НЕ зависит от режима отображения.
	 *  Бэк всегда работает в MSK (CTimeZone::Disable() в api.php), поэтому при отправке
	 *  и приёме данных используем именно эту константу, а не display-TZ. */
	mskOffsetMs = 3 * 3600 * 1000;

	/** TimeStore инжектится через setStore() в StoreProvider. */
	_store = null;

	/** Сдвиг текущей TZ-маски ОТОБРАЖЕНИЯ в мс относительно UTC. Реактивно из TimeStore. */
	get tzOffest() {
		return this._store?.tzOffsetMs ?? this.mskOffsetMs;
	}
	/** Сдвиг отображения в часах. */
	get tzHoursOffset() {
		return Math.round(this.tzOffest / 3600000);
	}
	/** Текстовый offset отображения для подстановки в ISO. */
	get tsStrOffset() {
		return this._store?.tzStrOffset ?? "+03:00";
	}

	/** Однократная инъекция из StoreProvider после создания TimeStore. */
	setStore(store) {
		this._store = store;
	}

	weekLen = 7 * 24 * 3600 * 1000; //неделя в мкс
	dayLen = 24 * 3600 * 1000; //сутки в мкс
	hourLen = 3600 * 1000; //час в мкс
	minLen = 60 * 1000; //минута в мкс

	wDays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

	//возвращает дату/время, которая по запросам getUTC* будет отдавать данные в московском часовом поясе
	getTime() {
		//украдено https://stackoverflow.com/a/10088053
		// create Date object for current location
		let d = new Date();

		// get UTC time in msec
		let utc = d.getTime();

		// create new Date object for different city
		// using supplied offset
		return new Date(utc + this.tzOffest);
	}

	//возвращает дату-время начала сегодняшнего (по МСК) дня
	getToday() {
		// getTime() возвращает Date, в полях getUTC* которой лежит МСК-время.
		// Обнуляем часы/минуты/сек/мс — получаем МСК-полночь, выраженную как UTC-поля,
		// затем сдвигаем обратно на tzOffest, чтобы получить реальный UTC-таймстамп этой полночи.
		// Прямой setUTCHours(-3,...) на new Date() ломается в окне 00:00-02:59 МСК,
		// когда UTC-дата ещё вчерашняя и -3 часа откатывают на позавчера.
		let mskNow = this.getTime();
		mskNow.setUTCHours(0, 0, 0, 0);
		return new Date(mskNow.getTime() - this.tzOffest);
	}

	getTimestamp() {
		const d = new Date();
		return d.getTime();
	}

	getUnixtime() {
		const d = new Date();
		return Math.floor(d.getTime() / 1000);
	}

	//форматирует остаток времени в мкс для оверлеев обратного отсчёта:
	//  - положительный: "HH:MM:SS" или "Nd HH:MM:SS" если суток > 0
	//  - отрицательный (просрочено): пустая строка (визуальную индикацию даёт css)
	strRemaining(ms) {
		if (ms < 0) return "";
		const totalSec = Math.floor(ms / 1000);
		const days = Math.floor(totalSec / 86400);
		const h = Math.floor((totalSec % 86400) / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		const hm = this.zeroPad(h) + ":" + this.zeroPad(m);
		if (days > 30) {
			return days + "д";
		} else if (days > 0) {
			return days + "д " + hm;
		}
		return hm + ":" + this.zeroPad(s);
	}

	//остаток времени для отсчёта до ПЛАНОВОЙ даты: она известна с точностью до дня,
	//поэтому без секунд (и отсчёт не нужно пересчитывать каждую секунду):
	//  - от 3 суток: "Nд";  от суток: "Nд Чч";  меньше суток: "Ч:ММ"
	//  - отрицательный: пустая строка
	strRemainingCoarse(ms) {
		if (ms < 0) return "";
		const totalMin = Math.floor(ms / 60000);
		const days = Math.floor(totalMin / 1440);
		const h = Math.floor((totalMin % 1440) / 60);
		const m = totalMin % 60;
		if (days >= 3) return days + "д";
		if (days >= 1) return days + "д " + h + "ч";
		return h + ":" + this.zeroPad(m);
	}

	//конверитирует разницу в мкс в вид [1d 23h 57m 11s]
	strDiff(diff) {
		let output = "";

		if (diff > this.dayLen) {
			let days = Math.floor(diff / this.dayLen);
			diff -= days * this.dayLen;
			output += days + "d ";
		}

		if (diff > this.hourLen) {
			let hours = Math.floor(diff / this.hourLen);
			diff -= hours * this.hourLen;
			output += hours + "h ";
		}

		if (diff > this.minLen) {
			let min = Math.floor(diff / this.minLen);
			diff -= min * this.minLen;
			output += min + "m ";
		}

		let sec = Math.floor(diff / 1000);
		output += sec + "s";

		return output;
	}

	objDate(time) {
		let t = new Date(time + this.tzOffest);
		let W = t.getUTCDay(); //по умолчанию 0 - вскр, 6 -суббота
		W--; //сдвигаем в диапазон [-1 - вс; 0..5 - пн..сб]
		if (W < 0) W = 6; //теперь это диапазон [0..6 => пн..вс]

		let Y = t.getUTCFullYear();
		let y = Y % 100;
		return {
			h: t.getUTCHours(),
			m: t.getMinutes(),
			s: t.getSeconds(),

			D: t.getUTCDate(),
			M: t.getUTCMonth() + 1, //месяц по умолчанию начинается с ноля, нам это неудобно

			Y: Y,
			y: y,

			W: W, //номер дня недели
			w: this.wDays[W], //короткий текст дня недели
		};
	}

	zeroPad(num) {
		if (num < 10) return "0" + num;
		return num;
	}

	//YYYY-MM-DD
	strDate(time) {
		let t = this.objDate(time);
		return (time = t.Y + "-" + this.zeroPad(t.M) + "-" + this.zeroPad(t.D));
	}

	//MM.DD.YY
	strDateHuman(time) {
		let t = this.objDate(time);
		return (time =
			this.zeroPad(t.D) +
			"." +
			this.zeroPad(t.M) +
			"." +
			String(t.Y).substring(2));
	}

	//MM.DD.YYYY (ww)
	strDateHumanLong(time) {
		let t = this.objDate(time);
		return (time =
			this.zeroPad(t.D) +
			"." +
			this.zeroPad(t.M) +
			"." +
			t.Y +
			"(" +
			t.w +
			")");
	}

	//MM.DD.YYYY (ww) hh:mm
	strDateTimeHumanLong(time) {
		let t = this.objDate(time);
		return (time =
			this.zeroPad(t.D) +
			"." +
			this.zeroPad(t.M) +
			"." +
			t.Y +
			"(" +
			t.w +
			") " +
			this.zeroPad(t.h) +
			":" +
			this.zeroPad(t.m));
	}

	shortDate(time) {
		let t = this.objDate(time);
		return this.zeroPad(t.D) + "." + this.zeroPad(t.M);
	}

	strWeekDayDate(time) {
		let t = this.objDate(time);
		return (time =
			this.zeroPad(t.D) + "." + this.zeroPad(t.M) + " (" + t.w + ")");
	}

	strDateTime(time) {
		let t = this.objDate(time);
		return (time =
			t.Y +
			"-" +
			this.zeroPad(t.M) +
			"-" +
			this.zeroPad(t.D) +
			" " +
			this.zeroPad(t.h) +
			":" +
			this.zeroPad(t.m) +
			":" +
			this.zeroPad(t.s));
	}

	//приводит текстовую запись даты-времени в формате Битрикса к формату JS.
	//Бэкенд (api.php) форсит MSK во всех слоях (PHP, MySQL, CTimeZone::Disable),
	//поэтому здесь жёсткий '+03:00' — НЕ зависит от режима отображения tzMode.
	bitrixDateTimeToJs(time) {
		if (typeof time !== "string") return null;
		let $tokens = time.split(" ");
		let $newDate = $tokens[0].split(".").reverse().join("-");
		if ($tokens.length === 2) {
			return Date.parse($newDate + "T" + $tokens[1] + "+03:00");
		} else {
			//console.log($newDate + "T00:00:00" + "+03:00");
			return Date.parse($newDate + "T00:00:00" + "+03:00");
		}
	}

	getWeek(time) {
		var date = new Date(time);
		date.setHours(0, 0, 0, 0);
		// Thursday in current week decides the year.
		date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
		// January 4 is always in week 1.
		var week1 = new Date(date.getFullYear(), 0, 4);
		// Adjust to Thursday in week 1 and count number of weeks from date to week1.
		return (
			1 +
			Math.round(
				((date.getTime() - week1.getTime()) / 86400000 -
					3 +
					((week1.getDay() + 6) % 7)) /
					7,
			)
		);
	}
}

export default TimeHelper = new TimeHelper();
