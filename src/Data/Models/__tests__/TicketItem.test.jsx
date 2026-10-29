import { runInAction } from 'mobx';
import TicketItem from '../TicketItem';
import ScheduleStore from '../../Stores/ScheduleStore';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Данные решённой заявки №54078: ответ ТП автору, автозакрытие через сутки. */
const WAITING_TICKET = {
	ID: '54078', OWNER_USER_ID: '2698', RESPONSIBLE_USER_ID: '4444',
	LAST_MESSAGE_USER_ID: '4444', LAST_MESSAGE_BY_SUPPORT_TEAM: 'Y',
	STATUS_ID: '10', STATUS_NAME: 'Успешно решено', AUTO_CLOSE_DAYS: '1',
	DATE_CLOSE: null, HOLD_ON: 'N', LAMP: 'red',
};

test.each(['red', 'green', 'green_s', 'yellow'])('ожидание автозакрытия №54078 не зависит от лампы %s', lamp => {
	const item = ticket(undefined, { ...WAITING_TICKET, LAMP: lamp });
	expect(item.status).toBe('blue');
	expect(item.isSlaActive).toBe(false);
	expect(item.isNow).toBe(false);
});

test.each([
	{ AUTO_CLOSE_DAYS: '0' },
	{ AUTO_CLOSE_DAYS: null },
	{ LAST_MESSAGE_BY_SUPPORT_TEAM: 'N' },
	{ STATUS_ID: '1' },
	{ HOLD_ON: 'Y' },
	{ DATE_CLOSE: '12.10.2026 12:00:00' },
])('заявка не ожидает автозакрытия при %j', overrides => {
	expect(ticket(undefined, { ...WAITING_TICKET, ...overrides }).status).not.toBe('blue');
});

test('нерешаемая заявка со статусом 9 тоже ожидает автозакрытия', () => {
	expect(ticket(undefined, { ...WAITING_TICKET, STATUS_ID: '9' }).status).toBe('blue');
});

test('старый API без новых полей распознаёт решённую заявку по названию статуса', () => {
	expect(ticket(undefined, {
		...WAITING_TICKET, STATUS_ID: undefined, AUTO_CLOSE_DAYS: undefined,
	}).status).toBe('blue');
});

/** Создать закрытую заявку с реальным расписанием пн–пт и датами API в МСК. */
function ticket(intervals = undefined, overrides = {}) {
	const context = { schedule: new ScheduleStore({}, 0), time: { today: 0 } };
	return new TicketItem({}, {
		ID: '1', OWNER_NAME: '', TITLE: 'Проверка', HOLD_ON: 'N',
		DATE_CREATE: '05.10.2026 12:00:00',
		DATE_CLOSE: '12.10.2026 12:00:00', LAST_MESSAGE_DATE: '12.10.2026 12:00:00',
		HOLD_INTERVALS: intervals, ...overrides,
	}, { getContext: () => context });
}

test('без истории старый API сохраняет расчёт с исключением выходных', () => {
	expect(ticket().workDaysToClose).toBe(5);
});

test('пауза пт–пн исключает один рабочий день, выходные не вычитаются дважды', () => {
	const item = ticket([{ START: '09.10.2026 12:00:00', END: '12.10.2026 12:00:00' }]);
	expect(item.holdIntervals).toHaveLength(1);
	expect(item.workDaysToClose).toBe(4);
});

test('несколько пауз и частичные сутки суммируются до округления', () => {
	const item = ticket([
		{ START: '05.10.2026 18:00:00', END: '06.10.2026 06:00:00' },
		{ START: '07.10.2026 12:00:00', END: '08.10.2026 12:00:00' },
	]);
	expect(item.workMsToClose).toBe(3.5 * DAY_MS);
	expect(item.workDaysToClose).toBe(3.5);
});

test('пауза без восстановления заканчивается в момент закрытия заявки', () => {
	expect(ticket([{ START: '06.10.2026 12:00:00', END: null }]).workDaysToClose).toBe(1);
});

test('пересечения и выход за границы заявки не дают отрицательной длительности', () => {
	expect(ticket([
		{ START: '01.10.2026 12:00:00', END: '08.10.2026 12:00:00' },
		{ START: '07.10.2026 12:00:00', END: '15.10.2026 12:00:00' },
	]).workDaysToClose).toBe(0);
});

test('перезагрузка истории пересчитывает длительность, открытая заявка не имеет времени закрытия', () => {
	const item = ticket();
	expect(item.workDaysToClose).toBe(5);
	runInAction(() => {
		item.holdIntervals = [{ start: item.createdAt, end: item.createdAt + DAY_MS }];
	});
	expect(item.workDaysToClose).toBe(4);
	expect(ticket([], { DATE_CLOSE: null }).workDaysToClose).toBeNull();
});
