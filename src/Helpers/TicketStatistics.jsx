import TimeHelper from 'Helpers/TimeHelper';
import { ticketWorkTime } from './TicketWorkTime';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Границы выбранного месяца без зависимости от часового пояса браузера. */
export function monthRange(month) {
	const [year, number] = month.split('-').map(Number);
	const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
	return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Предыдущий месяц относительно московской даты приложения. */
export function previousMonth() {
	const date = new Date(Date.now() + TimeHelper.mskOffsetMs);
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() - 1);
	return date.toISOString().slice(0, 7);
}

/** Пустые накопители сотрудника или итоговой строки. */
function emptySummary(id, name) {
	return { id, name, count: 0, closed: 0, open: 0, overdue: 0, held: 0,
		closedHeld: 0, workMs: 0, totalMs: 0, heldMs: 0, overdueMs: 0, averageMs: null, totalAverageMs: null };
}

/** Добавить заявку в итог; округление делается только при отображении. */
function accumulate(summary, row) {
	summary.count++;
	if (row.closed) {
		summary.closed++;
		summary.workMs += row.workMs;
		summary.totalMs += row.totalMs;
		summary.heldMs += row.heldMs;
		if (row.intervals.length) summary.closedHeld++;
		summary.averageMs = summary.workMs / summary.closed;
		summary.totalAverageMs = summary.totalMs / summary.closed;
	} else {
		summary.open++;
		if (row.held) summary.held++;
	}
	// Нарушение SLA учитываем независимо от того, закрыта заявка или ещё в работе.
	if (row.overdue) {
		summary.overdue++;
		summary.overdueMs += row.workMs;
	}
}

/** Сводка только по загруженным сотрудникам; персональный режим доски не ограничивает отчёт. */
export function buildTicketStatistics(report, schedule, employees, snapshot = 'period') {
	const asOf = TimeHelper.bitrixDateTimeToJs(report.asOf);
	const cutoff = snapshot === 'now' ? asOf : Math.min(asOf, TimeHelper.bitrixDateTimeToJs(report.periodEnd));
	const summaries = new Map(employees.map(employee => [Number(employee.id), emptySummary(Number(employee.id), employee.name)]));
	const rows = [];
	const total = emptySummary('total', 'Итого');
	for (const source of report.rows) {
		const userId = Number(source.RESPONSIBLE_USER_ID);
		const summary = summaries.get(userId);
		if (!summary) continue;
		const createdAt = TimeHelper.bitrixDateTimeToJs(source.DATE_CREATE);
		if (createdAt > cutoff) continue;
		const closeAt = source.REPORT_CLOSE_DATE ? TimeHelper.bitrixDateTimeToJs(source.REPORT_CLOSE_DATE) : null;
		const closed = Number.isFinite(closeAt) && closeAt <= cutoff;
		const intervals = (source.HOLD_INTERVALS ?? []).map(interval => ({
			start: TimeHelper.bitrixDateTimeToJs(interval.START),
			end: interval.END ? TimeHelper.bitrixDateTimeToJs(interval.END) : null,
		}));
		const held = !closed && intervals.some(interval => interval.start <= cutoff
			&& (interval.end === null || interval.end > cutoff));
		const timing = ticketWorkTime(schedule, createdAt, closed ? closeAt : cutoff, intervals);
		const exclusion = source.EXCLUSION_REASON || (!Number.isFinite(createdAt) ? 'Некорректная дата создания' : null);
		const row = { id: Number(source.ID), title: source.TITLE, userId, name: summary.name,
			createdAt, closeAt: closed ? closeAt : null, endAt: closed ? closeAt : cutoff,
			closed, held, exclusion, ...timing,
			overdue: timing.workMs > report.overdueDays * DAY_MS };
		rows.push(row);
		if (!exclusion) {
			accumulate(summary, row);
			accumulate(total, row);
		}
	}
	return { rows, summaries: [...summaries.values()], total, cutoff };
}

/** Отбор расшифровки по сотруднику и показателю сводки. */
export function statisticsDetails(rows, selection, excluded = false) {
	return rows.filter(row => Boolean(row.exclusion) === excluded
		&& (!selection || selection.userId === 'total' || row.userId === selection.userId)
		&& (!selection || selection.metric === 'count' || selection.metric === 'excluded'
			|| (selection.metric === 'closed' && row.closed)
			|| (selection.metric === 'open' && !row.closed)
			|| (selection.metric === 'overdue' && row.overdue)
			|| (selection.metric === 'held' && row.held)
			|| (selection.metric === 'closedHeld' && row.closed && row.intervals.length > 0)));
}

/** CSV с защитой текстовых ячеек от формул и с кавычками для разделителей. */
export function statisticsCsv(matrix) {
	return '\uFEFF' + matrix.map(row => row.map(value => {
		let text = String(value ?? '');
		if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
		return '"' + text.replaceAll('"', '""') + '"';
	}).join(';')).join('\r\n');
}
