/** Рабочее время заявки и пауз; интервалы ограничиваются сроком заявки и объединяются. */
export function ticketWorkTime(schedule, createdAt, endAt, holdIntervals = []) {
	if (!Number.isFinite(createdAt) || !Number.isFinite(endAt) || endAt <= createdAt) {
		return { totalMs: 0, heldMs: 0, workMs: 0, intervals: [] };
	}
	const intervals = holdIntervals.filter(interval => Number.isFinite(interval.start)
		&& (interval.end === null || Number.isFinite(interval.end))).map(interval => ({
		start: Math.max(createdAt, interval.start),
		end: Math.min(endAt, interval.end ?? endAt),
	})).filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start);
	const merged = [];
	for (const interval of intervals) {
		const previous = merged[merged.length - 1];
		// Перекрывающиеся паузы исключаем только один раз.
		if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
		else merged.push({ ...interval });
	}
	const totalMs = schedule.workMsBetween(createdAt, endAt);
	const heldMs = merged.reduce((sum, interval) => sum + schedule.workMsBetween(interval.start, interval.end), 0);
	return { totalMs, heldMs, workMs: Math.max(0, totalMs - heldMs), intervals: merged };
}
