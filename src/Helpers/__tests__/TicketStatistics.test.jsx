import ScheduleStore from 'Data/Stores/ScheduleStore';
import { buildTicketStatistics, DAY_MS, monthRange, statisticsCsv, statisticsDetails } from '../TicketStatistics';

const employees = [{ id: 1, name: 'Иванов' }, { id: 2, name: 'Петров' }, { id: 3, name: 'Без заявок' }];
const schedule = new ScheduleStore({}, 0);

/** Минимальная строка ответа API статистики. */
function row(id, userId, created, closed, extra = {}) {
	return { ID: id, RESPONSIBLE_USER_ID: userId, TITLE: `Заявка ${id}`,
		DATE_CREATE: created, REPORT_CLOSE_DATE: closed, HOLD_INTERVALS: [], EXCLUSION_REASON: null, ...extra };
}

/** Ответ API со срезом прошлого периода и более поздней датой загрузки. */
function report(rows) {
	return { rows, asOf: '15.10.2026 12:00:00', periodEnd: '12.10.2026 12:00:00', overdueDays: 2 };
}

test('итоговое среднее взвешено числом заявок, тёзки и сотрудники без заявок не теряются', () => {
	const stats = buildTicketStatistics(report([
		row(1, 1, '05.10.2026 12:00:00', '06.10.2026 12:00:00'),
		row(2, 1, '05.10.2026 12:00:00', '06.10.2026 12:00:00'),
		row(3, 2, '05.10.2026 12:00:00', '08.10.2026 12:00:00'),
		row(4, 99, '05.10.2026 12:00:00', '06.10.2026 12:00:00'),
	]), schedule, employees.map(employee => ({ ...employee, name: 'Тёзка' })));
	expect(stats.total.closed).toBe(3);
	expect(stats.total.averageMs).toBeCloseTo(5 * DAY_MS / 3);
	expect(stats.summaries).toHaveLength(3);
	expect(stats.summaries[2].averageMs).toBeNull();
	expect(stats.rows).toHaveLength(3);
});

test('срез исключает будущее закрытие и будущую паузу, действующую паузу ограничивает датой среза', () => {
	const data = report([
		row(1, 1, '05.10.2026 12:00:00', '14.10.2026 12:00:00', { HOLD_INTERVALS: [
			{ START: '09.10.2026 12:00:00', END: '14.10.2026 12:00:00' },
		] }),
		row(2, 1, '05.10.2026 12:00:00', null, { HOLD_INTERVALS: [
			{ START: '13.10.2026 12:00:00', END: null },
		] }),
		row(3, 1, '13.10.2026 12:00:00', null),
	]);
	const past = buildTicketStatistics(data, schedule, employees);
	expect(past.total.count).toBe(2);
	expect(past.total.closed).toBe(0);
	expect(past.total.held).toBe(1);
	expect(past.rows[0].workMs).toBe(4 * DAY_MS);
	const current = buildTicketStatistics(data, schedule, employees, 'now');
	expect(current.total.closed).toBe(1);
	expect(current.total.count).toBe(3);
});

test('исключения не влияют на итог; ровно 2 рабочих суток в пределах SLA, более 2 — просрочка', () => {
	const stats = buildTicketStatistics(report([
		row(1, 1, '08.10.2026 12:00:00', null),
		row(2, 2, '07.10.2026 12:00:00', null),
		row(3, 1, '01.10.2026 12:00:00', '12.10.2026 12:00:00', { EXCLUSION_REASON: 'Тестовая заявка' }),
	]), schedule, employees);
	expect(stats.total.count).toBe(2);
	expect(stats.total.overdue).toBe(1);
	expect(statisticsDetails(stats.rows, { userId: 'total', metric: 'overdue' }).map(item => item.id)).toEqual([2]);
	expect(statisticsDetails(stats.rows, { userId: 1, metric: 'count' }).map(item => item.id)).toEqual([1]);
	expect(statisticsDetails(stats.rows, { userId: 'total', metric: 'excluded' }, true).map(item => item.id)).toEqual([3]);
});

test('пауза целиком в выходные не уменьшает время выполнения', () => {
	const stats = buildTicketStatistics(report([
		row(1, 1, '09.10.2026 12:00:00', '12.10.2026 12:00:00', { HOLD_INTERVALS: [
			{ START: '10.10.2026 00:00:00', END: '12.10.2026 00:00:00' },
		] }),
	]), schedule, employees);
	expect(stats.total.averageMs).toBe(DAY_MS);
	expect(stats.total.heldMs).toBe(0);
	expect(stats.total.closedHeld).toBe(1);
});

test('порог 2 суток применяется после вычитания отложенности, до округления', () => {
	const pauses = [{ START: '06.10.2026 12:00:00', END: '09.10.2026 12:00:00' }];
	const stats = buildTicketStatistics(report([
		row(1, 1, '05.10.2026 12:00:00', null, { HOLD_INTERVALS: pauses }),
		row(2, 1, '05.10.2026 11:59:00', null, { HOLD_INTERVALS: pauses }),
		row(3, 1, '05.10.2026 12:00:00', '12.10.2026 12:00:00'),
		row(4, 2, '05.10.2026 12:00:00', '12.10.2026 12:00:00', { HOLD_INTERVALS: pauses }),
	]), schedule, employees);
	expect(stats.rows[0].workMs).toBe(2 * DAY_MS);
	expect(stats.rows[0].overdue).toBe(false);
	expect(stats.rows[1].workMs).toBe(2 * DAY_MS + 60000);
	expect(stats.rows[1].overdue).toBe(true);
	expect(stats.rows[2].overdue).toBe(true);
	expect(stats.rows[3].overdue).toBe(false);
	expect(stats.total.overdue).toBe(2);
	expect(stats.total.overdueMs).toBe(7 * DAY_MS + 60000);
	expect(stats.summaries[0].overdue).toBe(2);
	expect(stats.summaries[1].overdue).toBe(0);
	expect(statisticsDetails(stats.rows, { userId: 'total', metric: 'overdue' }).map(item => item.id)).toEqual([2, 3]);
});

test('время многолетней заявки считается без обрезания до 366 дней', () => {
	const start = Date.parse('2024-01-01T00:00:00+03:00');
	const middle = Date.parse('2025-01-01T00:00:00+03:00');
	const end = Date.parse('2026-01-01T00:00:00+03:00');
	expect(schedule.workMsBetween(start, end)).toBe(schedule.workMsBetween(start, middle) + schedule.workMsBetween(middle, end));
});

test('границы месяца учитывают високосный год; CSV экранирует кавычки и формулы', () => {
	expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
	expect(statisticsCsv([['=SUM(A1)', 'Название;"текст"', 0]])).toBe('\uFEFF"\'=SUM(A1)";"Название;""текст""";"0"');
});
