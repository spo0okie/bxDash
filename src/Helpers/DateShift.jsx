/**
 * Сдвиг срока элемента из контекстного меню: «Отодвинуть срок» / «Приблизить срок».
 * Чистые функции — без сторов, чтобы правила доступности пунктов проверялись тестами.
 */

const DAY = 24 * 3600 * 1000;

/** Интервалы сдвига — одни и те же в обе стороны. Месяц — 30 дней, как было исторически. */
export const SHIFT_INTERVALS = [
	{ id: 'week1', label: 'на 1 неделю', ms: 7 * DAY },
	{ id: 'week2', label: 'на 2 недели', ms: 14 * DAY },
	{ id: 'month1', label: 'на 1 месяц', ms: 30 * DAY },
	{ id: 'month2', label: 'на 2 месяца', ms: 60 * DAY },
];

/** Интервал по id пункта меню */
export function shiftInterval(id) {
	return SHIFT_INTERVALS.find(interval => interval.id === id) ?? null;
}

/**
 * Каким полем элемент позиционируется во времени: у задачи это плановая дата
 * (startDatePlan), у работы — deadline. То же правило, что в DndHelper.
 */
export function dateFieldOf(item) {
	return item.dropTimeField || 'deadline';
}

/**
 * Можно ли приблизить срок элемента на ms.
 * Нельзя, если элемент закрыт, даты нет вовсе или после сдвига она окажется раньше сегодняшнего дня.
 * Пример: задача через 3 недели — на 1 и 2 недели можно, на месяц нельзя.
 *
 * @param {Object} item   элемент (нужны isClosed, t и поле даты)
 * @param {number} ms     на сколько приближаем
 * @param {number} today  начало сегодняшнего дня (time.today)
 */
export function canShiftEarlier(item, ms, today) {
	if (item.isClosed) return false;
	// даты нет: элемент лежит в долгом ящике, приближать нечего
	if (!item[dateFieldOf(item)]) return false;
	if (item.t === null || item.t === undefined) return false;
	return item.t - ms >= today;
}

/** Новая дата после сдвига: direction +1 — отодвинуть, -1 — приблизить. Без даты считаем от сегодня. */
export function shiftedDate(item, ms, direction, today) {
	const from = item.t === null || item.t === undefined ? today : item.t;
	return from + direction * ms;
}
