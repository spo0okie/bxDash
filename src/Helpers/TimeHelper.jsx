/*
Задача класса выдавать результаты в выбранном TimeStore часовом поясе.
Сам режим TZ хранится в TimeStore.tzMode, инжектится через setStore().
*/
class TimeHelper {
	/** Передаёт полученный при входе пояс в реактивное хранилище времени. */
	setBitrixOffset(offset) {
		if (typeof offset !== 'string' || !/^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.test(offset)) {
			throw new Error('Bitrix API не вернул корректный timezoneOffset');
		}
		this._store?.setBitrixOffset(offset);
	}

	/** Смещение дат отчёта соответствует календарю API. */
	get bitrixOffsetMs() {
		return (this._store?.bitrixOffsetMin ?? 0) * 60000;
	}

	/** API принимает Unix-секунды. */
	toBitrixTimestamp(time) {
		return Math.round(time / 1000);
	}

	/** TimeStore инжектится через setStore() в StoreProvider. */
	_store = null;

	/** Сдвиг текущей TZ-маски ОТОБРАЖЕНИЯ в мс относительно UTC. Реактивно из TimeStore. */
	get tzOffest() {
		return this._store?.tzOffsetMs ?? -new Date().getTimezoneOffset() * 60000;
	}
	/** Сдвиг отображения в часах. */
	get tzHoursOffset() {
		return Math.round(this.tzOffest / 3600000);
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

	/** Возвращает текущее время выбранного пояса в полях getUTC*. */
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

	/** Возвращает Unix-время полуночи выбранного пояса. */
	getToday() {
		// Обнуляем время в выбранном поясе, затем возвращаемся к реальному Unix-времени.
		const localMidnight = this.getTime();
		localMidnight.setUTCHours(0, 0, 0, 0);
		return new Date(localMidnight.getTime() - this.tzOffest);
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
			m: t.getUTCMinutes(),
			s: t.getUTCSeconds(),

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
	// Пояс строки задаёт API, пользовательский режим меняет только отображение.
	bitrixDateTimeToJs(time) {
		if (typeof time !== "string" || !time) return null;
		const offset = this._store?.bitrixOffset;
		if (!offset) throw new Error('Смещение дат Bitrix ещё не получено');
		let $tokens = time.split(" ");
		let $newDate = $tokens[0].split(".").reverse().join("-");
		const clock = $tokens.length === 2 ? $tokens[1] : '00:00:00';
		return Date.parse($newDate + 'T' + clock + offset);
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
