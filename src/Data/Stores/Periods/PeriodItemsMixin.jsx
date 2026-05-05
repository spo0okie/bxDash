/**
 * Общий миксин для IntervalItem и PeriodItem.
 *
 * Даёт чистый предикат filterItem(item) — попадает ли элемент в этот период
 * по своему времени t. Используется при декларативной выборке элементов
 * (PeriodItem._pick) без двусторонних ссылок.
 *
 * Bucket — период с end===null. В bucket попадают элементы с t===null
 * (нет срока) и любые элементы с t >= start.
 */
const PeriodItemsMixin = {
	filterItem(item) {
		if (item.t === null) return this.end === null;
		if (item.t < this.start) return false;
		if (this.end === null) return true;
		return item.t < this.end;
	},
};

export default PeriodItemsMixin;
