import { SHIFT_INTERVALS, shiftInterval, dateFieldOf, canShiftEarlier, shiftedDate } from 'Helpers/DateShift';
import TimeHelper from 'Helpers/TimeHelper';

const DAY = 24 * 3600 * 1000;
const TODAY = 1000 * DAY;				// начало «сегодня»
const NINE = 9 * 3600 * 1000;			// плановая дата ставится на 09:00

/** Задача с плановой датой через days дней */
const task = (days, extra = {}) => {
	const plan = days === null ? null : TODAY + days * DAY + NINE;
	return { dropTimeField: 'startDatePlan', startDatePlan: plan, t: plan, isClosed: false, ...extra };
};

const available = item => SHIFT_INTERVALS.filter(i => canShiftEarlier(item, i.ms, TODAY)).map(i => i.id);

describe('canShiftEarlier', () => {
	test('задача через 3 недели: неделя и две доступны, месяцы — нет', () => {
		expect(available(task(21))).toEqual(['week1', 'week2']);
	});

	test('чем дальше срок, тем больше доступных интервалов', () => {
		expect(available(task(3))).toEqual([]);
		expect(available(task(7))).toEqual(['week1']);
		expect(available(task(35))).toEqual(['week1', 'week2', 'month1']);
		expect(available(task(70))).toEqual(['week1', 'week2', 'month1', 'month2']);
	});

	test('граница: приблизить ровно на сегодня можно, на вчера — нельзя', () => {
		const item = task(7);
		expect(canShiftEarlier(item, 7 * DAY, TODAY)).toBe(true);
		expect(canShiftEarlier(item, 8 * DAY, TODAY)).toBe(false);
	});

	test('без плановой даты (долгий ящик) приближать нечего', () => {
		expect(available(task(null))).toEqual([]);
	});

	test('закрытая задача не сдвигается', () => {
		expect(available(task(70, { isClosed: true }))).toEqual([]);
	});

	test('задача в работе стоит на «сегодня» — приближать некуда', () => {
		// у задачи в работе t === today, хотя плановая дата может быть в будущем
		expect(available(task(70, { t: TODAY }))).toEqual([]);
	});

	test('у работы срок — поле deadline', () => {
		const job = { deadline: TODAY + 20 * DAY, t: TODAY + 20 * DAY, isClosed: false };
		expect(dateFieldOf(job)).toBe('deadline');
		expect(dateFieldOf(task(1))).toBe('startDatePlan');
		expect(available(job)).toEqual(['week1', 'week2']);
	});
});

describe('shiftedDate / shiftInterval', () => {
	test('сдвиг в обе стороны', () => {
		const item = task(21);
		const week = shiftInterval('week1').ms;
		expect(shiftedDate(item, week, -1, TODAY)).toBe(item.t - 7 * DAY);
		expect(shiftedDate(item, week, 1, TODAY)).toBe(item.t + 7 * DAY);
	});

	test('отодвинуть элемент без даты — считаем от сегодня', () => {
		expect(shiftedDate(task(null), 7 * DAY, 1, TODAY)).toBe(TODAY + 7 * DAY);
	});

	test('неизвестный интервал — null', () => {
		expect(shiftInterval('year1')).toBeNull();
	});
});

describe('TimeHelper.strRemainingCoarse', () => {
	const H = 3600 * 1000;
	test('от трёх суток — только дни', () => {
		expect(TimeHelper.strRemainingCoarse(21 * DAY + 5 * H)).toBe('21д');
		expect(TimeHelper.strRemainingCoarse(3 * DAY)).toBe('3д');
	});
	test('от суток до трёх — дни и часы', () => {
		expect(TimeHelper.strRemainingCoarse(DAY + 4 * H + 59 * 60000)).toBe('1д 4ч');
	});
	test('меньше суток — часы и минуты, без секунд', () => {
		expect(TimeHelper.strRemainingCoarse(5 * H + 7 * 60000 + 59000)).toBe('5:07');
		expect(TimeHelper.strRemainingCoarse(59000)).toBe('0:00');
	});
	test('прошедшая дата — пусто', () => {
		expect(TimeHelper.strRemainingCoarse(-1)).toBe('');
	});
});
