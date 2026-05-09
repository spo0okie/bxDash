/**
 * ScheduleRuntime — рантайм для работы с компилированными расписаниями (compiled_json).
 *
 * Источник: arms/modules/schedules/compile/lib/js/demo.js
 * Здесь — ESM-обёртка без изменения логики (CommonJS-экспорт и window-инжект убраны).
 * При обновлении исходной библиотеки в Inventory тело класса нужно синхронизировать.
 */

const MINUTES_IN_DAY = 1440;
const MS_IN_MINUTE = 60000;

class ScheduleRuntime {
	constructor(compiledJson) {
		this.schedule = compiledJson;
		this.main = compiledJson.main || {};
		this.overrides = compiledJson.overrides || [];
	}

	isWorkDay(date) {
		const tsm = strToTsm(date);
		if (tsm === null) return false;
		const intervals = this.getDateIntervals(tsm);
		return intervals.length > 0;
	}

	isWorkTime(dateTime) {
		const tsm = strToTsm(dateTime);
		if (tsm === null) return false;
		const intervals = this.getDateIntervals(tsm);
		return intervalsContains(intervals, tsm) !== null;
	}

	getMeta(dateTime) {
		const tsm = strToTsm(dateTime);
		if (tsm === null) return null;
		const intervals = this.getDateIntervals(tsm);
		const interval = intervalsContains(intervals, tsm);
		if (interval === null) return null;
		return interval[2] || null;
	}

	nextWorkingDateTime(dateTime) {
		let pos = strToTsm(dateTime);
		if (pos === null) return null;

		if (this.main.start_tsm !== null && this.main.start_tsm !== undefined && pos < this.main.start_tsm) {
			pos = this.main.start_tsm;
		}

		while (inBounds(pos, this.main)) {
			const nonWorkPeriod = this.findPeriod(pos, false);
			if (nonWorkPeriod !== null) {
				pos = nonWorkPeriod.end_tsm;
				continue;
			}

			const target = this.findOverride(pos);
			const entry = this.nextRecord(pos, target);

			if (entry === null) {
				if (target.end_tsm !== null && target.end_tsm !== undefined) {
					pos = target.end_tsm + 1;
				} else {
					return null;
				}
				continue;
			}

			if (entry.type === 'period') {
				return tsmToStr(entry.start_tsm);
			} else if (entry.type === 'override') {
				pos = entry.start_tsm;
				continue;
			} else {
				const dayStart = entry.date_tsm ?? tsmToDateTsm(pos);
				const workStart = dayStart + entry.intervals[0][0];
				return tsmToStr(Math.max(pos, workStart));
			}
		}
		return null;
	}

	nextWorkingMeta(dateTime) {
		const nextWorktime = this.nextWorkingDateTime(dateTime);
		if (nextWorktime === null) return null;

		const tsm = strToTsm(dateTime);
		const nextTsm = strToTsm(nextWorktime);

		if (nextTsm < tsm) return this.getMeta(tsmToStr(tsm));
		return this.getMeta(nextWorktime);
	}

	getDateIntervals(date) {
		const dateTsm = tsmToDateTsm(date);
		if (dateTsm === null) return [];
		if (!inBounds(dateTsm, this.main)) return [];
		const target = this.findOverride(dateTsm);
		const baseIntervals = this.getEntryIntervals(target, dateTsm);
		const periods = this.getDatePeriodsIntervals(dateTsm);
		return this.applyPeriodsToDay(baseIntervals, periods);
	}

	getDatePeriods(dateTsm) {
		const dayStart = tsmToDateTsm(dateTsm);
		const dayEnd = dayStart + MINUTES_IN_DAY;
		const result = [];
		const periods = this.main.periods || [];
		for (const period of periods) {
			if (period.end_tsm > dayStart && period.start_tsm < dayEnd) {
				result.push(period);
			}
		}
		return result;
	}

	getDatePeriodsIntervals(dateTsm) {
		const periods = this.getDatePeriods(dateTsm);
		const dayStart = tsmToDateTsm(dateTsm);
		const dayEnd = dayStart + MINUTES_IN_DAY;
		const positive = [];
		const negative = [];
		for (const period of periods) {
			const intervalStart = Math.max(period.start_tsm, dayStart);
			const intervalEnd = Math.min(period.end_tsm, dayEnd);
			const startMinute = intervalStart - dayStart;
			const endMinute = intervalEnd - dayStart;
			const interval = [startMinute, endMinute, period.meta || {}];
			if (period.is_work === true) positive.push(interval);
			else negative.push(interval);
		}
		return { positive, negative };
	}

	findOverride(tsm) {
		for (const override of this.overrides) {
			if (inBounds(tsm, override)) return override;
		}
		return this.main;
	}

	nextOverride(tsm) {
		for (const override of this.overrides) {
			if (override.start_tsm >= tsm) return override;
		}
		return null;
	}

	findPeriod(tsm, isWork = null) {
		for (const period of this.main.periods || []) {
			if (inBounds(tsm, period) && (isWork === null || isWork === period.is_work)) {
				return period;
			}
		}
		return null;
	}

	nextPeriod(tsm, isWork = null) {
		for (const period of this.main.periods || []) {
			if (period.end_tsm > tsm && (isWork === null || isWork === period.is_work)) {
				return period;
			}
		}
		return null;
	}

	getEntryIntervals(target, dateTsm) {
		const dateTsmKey = String(dateTsm);
		if (target.dates && target.dates[dateTsmKey]) {
			return target.dates[dateTsmKey].intervals || [];
		}
		const dayOfWeekNum = String(dayOfWeek(dateTsm));
		if (target.weekdays && target.weekdays[dayOfWeekNum]) {
			return target.weekdays[dayOfWeekNum].intervals || [];
		}
		if (target.default) return target.default.intervals || [];
		return [];
	}

	filterBefore(entry, tsm) {
		const tsmDate = tsmToDateTsm(tsm);
		if (entry.date_tsm !== tsmDate) return entry;
		const minutesFromDay = tsm - tsmDate;
		const filteredIntervals = entry.intervals.filter(int => int[1] > minutesFromDay);
		return { ...entry, intervals: filteredIntervals };
	}

	nextWorkDateEntry(tsm, target) {
		if (!target.dates) return null;
		for (const [dateTsmStr, entry] of Object.entries(target.dates)) {
			const dateTsm = parseInt(dateTsmStr, 10);
			const dayEndTsm = dateTsm + MINUTES_IN_DAY;
			if (entry.intervals?.length > 0 && dayEndTsm > tsm) {
				const filteredEntry = this.filterBefore(entry, tsm);
				if (filteredEntry.intervals.length > 0) return filteredEntry;
			}
		}
		return null;
	}

	nextWeekDayEntry(pos, target) {
		const dayOfWeekNum = dayOfWeek(pos);
		const dayStart = tsmToDateTsm(pos);
		for (let i = 0; i < 7; i++) {
			const checkDay = (dayOfWeekNum + i - 1) % 7 + 1;
			const weekday = target.weekdays?.[String(checkDay)] || target.default;
			const tsmDate = dayStart + (i * MINUTES_IN_DAY);
			if (weekday?.intervals?.length > 0) {
				const entry = { ...weekday, date_tsm: tsmDate };
				const filteredEntry = this.filterBefore(entry, pos);
				if (filteredEntry.intervals.length > 0) return filteredEntry;
			}
		}
		return null;
	}

	applyPeriodsToDay(baseIntervals, periods) {
		let intervals = [...baseIntervals];
		for (const neg of periods.negative) {
			intervals = intervalsSubtract(intervals, neg);
		}
		for (const pos of periods.positive) {
			intervals = intervalsAdd(intervals, pos);
		}
		return intervals;
	}

	nextRecord(pos, target) {
		const isMain = (target === this.main);
		const candidates = [];

		const period = this.nextPeriod(pos, true);
		if (period) {
			period.type = 'period';
			candidates.push(period);
		}

		const weekEntry = this.nextWeekDayEntry(pos, target);
		if (weekEntry) {
			weekEntry.type = 'weekday';
			weekEntry.start_tsm = weekEntry.date_tsm;
			candidates.push(weekEntry);
		}

		if (isMain) {
			const override = this.nextOverride(pos);
			if (override) {
				override.type = 'override';
				candidates.push(override);
			}
			const dateEntry = this.nextWorkDateEntry(pos, target);
			if (dateEntry) {
				dateEntry.type = 'date';
				dateEntry.start_tsm = dateEntry.date_tsm;
				candidates.push(dateEntry);
			}
		}

		if (candidates.length === 0) return null;
		candidates.sort((a, b) => a.start_tsm - b.start_tsm);
		return candidates[0];
	}
}

function strToTsm(str) {
	if (!str) return null;
	if (str.length === 10) str += ' 00:00';
	const date = new Date(str.replace(' ', 'T') + 'Z');
	if (isNaN(date.getTime())) return null;
	return Math.floor(date.getTime() / MS_IN_MINUTE);
}

function tsmToStr(tsm) {
	if (tsm === null || tsm === undefined) return null;
	const date = new Date(tsm * MS_IN_MINUTE);
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function tsmToDateTsm(tsm) {
	if (tsm === null || tsm === undefined) return null;
	return Math.floor(tsm / MINUTES_IN_DAY) * MINUTES_IN_DAY;
}

function dayOfWeek(tsm) {
	if (tsm === null || tsm === undefined) return null;
	const date = new Date(tsm * MS_IN_MINUTE);
	const dow = date.getUTCDay();
	return dow === 0 ? 7 : dow;
}

function inBounds(tsm, bounds) {
	if (!bounds) return false;
	if (bounds.start_tsm !== null && bounds.start_tsm !== undefined && tsm < bounds.start_tsm) return false;
	if (bounds.end_tsm !== null && bounds.end_tsm !== undefined && tsm >= bounds.end_tsm) return false;
	return true;
}

function intervalsContains(intervals, tsm) {
	if (!intervals || intervals.length === 0) return null;
	const dayStart = tsmToDateTsm(tsm);
	const minutesFromDay = tsm - dayStart;
	for (const interval of intervals) {
		const start = interval[0];
		const end = interval[1];
		if (minutesFromDay >= start && minutesFromDay < end) return interval;
	}
	return null;
}

function intervalsSubtract(intervals, subtract) {
	if (!intervals || intervals.length === 0) return [];
	if (!subtract || subtract[1] <= subtract[0]) return [...intervals];
	const subStart = subtract[0];
	const subEnd = subtract[1];
	const result = [];
	for (const interval of intervals) {
		const intStart = interval[0];
		const intEnd = interval[1];
		if (subEnd <= intStart || subStart >= intEnd) { result.push(interval); continue; }
		if (subStart <= intStart && subEnd >= intEnd) continue;
		if (subStart > intStart && subEnd >= intEnd) { result.push([intStart, subStart, interval[2]]); continue; }
		if (subStart <= intStart && subEnd < intEnd) { result.push([subEnd, intEnd, interval[2]]); continue; }
		if (subStart > intStart && subEnd < intEnd) {
			result.push([intStart, subStart, interval[2]]);
			result.push([subEnd, intEnd, interval[2]]);
		}
	}
	return result;
}

function intervalsAdd(intervals, override) {
	if (!intervals || intervals.length === 0) {
		if (!override || override.length === 0 || override[1] <= override[0]) return [];
		return [[...override]];
	}
	if (!override || override.length === 0 || override[1] <= override[0]) return [...intervals];

	let result = intervalsSubtract(intervals, override);
	const overrideStart = override[0];
	let inserted = false;
	for (let i = 0; i < result.length; i++) {
		if (result[i][0] > overrideStart) {
			result.splice(i, 0, [...override]);
			inserted = true;
			break;
		}
	}
	if (!inserted) result.push([...override]);
	return result;
}

export {
	ScheduleRuntime,
	strToTsm,
	tsmToStr,
	tsmToDateTsm,
	dayOfWeek,
	inBounds,
	intervalsContains,
	intervalsSubtract,
	intervalsAdd,
	MINUTES_IN_DAY,
	MS_IN_MINUTE,
};
