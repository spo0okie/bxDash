import { action, makeObservable, observable, runInAction, when } from 'mobx';
import { ScheduleRuntime, strToTsm, tsmToStr, MS_IN_MINUTE, MINUTES_IN_DAY } from 'Vendor/scheduleRuntime/scheduleRuntime';

/**
 * ScheduleStore — загружает compiled_json рабочего расписания из Inventory
 * и держит ScheduleRuntime для SLA-расчётов.
 *
 * Запросы к Inventory идут только когда BackendSystem подтвердил OK availability+auth,
 * иначе fetch() кидает «Backend is unreachable». Поэтому загрузку откладываем
 * через mobx.when().
 */
class ScheduleStore {
	main;
	scheduleId;

	/** @type {Object|null} compiled_json из Inventory */
	compiled = null;
	/** Время последней загрузки, для отладки */
	loadedAt = null;
	/** Текст ошибки, если загрузка не удалась */
	error = null;

	/** @type {ScheduleRuntime|null} Не observable (тяжёлый, и используется как «чёрный ящик»). */
	runtime = null;

	constructor(main, scheduleId) {
		this.main = main;
		this.scheduleId = Number(scheduleId) || 0;

		makeObservable(this, {
			compiled: observable.ref,
			loadedAt: observable,
			error: observable,
			setCompiled: action,
			setError: action,
		});

		if (!this.scheduleId) return;

		when(
			() => this.main.inventory.availability === 'OK' && this.main.inventory.authStatus === 'OK',
			() => this.load(),
		);
	}

	setCompiled(compiled) {
		this.compiled = compiled;
		this.loadedAt = Date.now();
		this.error = null;
		this.runtime = compiled ? new ScheduleRuntime(compiled) : null;
	}

	setError(error) {
		this.error = error;
		this.runtime = null;
	}

	async load() {
		if (!this.scheduleId) return;
		try {
			const response = await this.main.inventory.fetch(`api/schedules/${this.scheduleId}`);
			if (!response.ok) {
				console.error('ScheduleStore: load failed', response.status, response.statusText);
				this.setError(`HTTP ${response.status}`);
				return;
			}
			const data = await response.json();
			let compiled = data?.compiled_json ?? null;
			if (typeof compiled === 'string') {
				try { compiled = JSON.parse(compiled); }
				catch (e) { console.error('ScheduleStore: compiled_json parse error', e); compiled = null; }
			}
			if (!compiled || !compiled.main) {
				this.setError('compiled_json пуст или некорректен');
				return;
			}
			runInAction(() => this.setCompiled(compiled));
		} catch (error) {
			console.error('ScheduleStore: load error', error);
			this.setError(String(error));
		}
	}

	/** Минуты сдвига часового пояса расписания относительно UTC. */
	get tzShiftMin() {
		const v = this.compiled?.tz_shift_tsm;
		return typeof v === 'number' ? v : 0;
	}

	/**
	 * Преобразует «реальный» Unix-timestamp (мс) в строку 'YYYY-MM-DD HH:MM',
	 * которую ScheduleRuntime интерпретирует как UTC.
	 *
	 * Compiled_json хранит даты как «локальное TZ, упакованное в UTC-минуты»
	 * (см. SchedulesCompiler::tzShiftMinutes), поэтому к реальному UTC прибавляем сдвиг TZ.
	 */
	realMsToScheduleStr(ms) {
		const shifted = new Date(ms + this.tzShiftMin * MS_IN_MINUTE);
		const y = shifted.getUTCFullYear();
		const M = String(shifted.getUTCMonth() + 1).padStart(2, '0');
		const d = String(shifted.getUTCDate()).padStart(2, '0');
		const h = String(shifted.getUTCHours()).padStart(2, '0');
		const m = String(shifted.getUTCMinutes()).padStart(2, '0');
		return `${y}-${M}-${d} ${h}:${m}`;
	}

	/** Реальный Unix-timestamp (мс) из tsm расписания. */
	scheduleTsmToRealMs(tsm) {
		if (tsm === null || tsm === undefined) return null;
		return (tsm - this.tzShiftMin) * MS_IN_MINUTE;
	}

	/**
	 * Прибавляет к moment N рабочих дней по расписанию и возвращает реальный мс-таймстамп.
	 * Алгоритм: идём от ближайшего рабочего дня вперёд, пропуская выходные.
	 *
	 * Возвращает null, если ScheduleRuntime ещё не загружен или не нашлось N рабочих дней
	 * в обозримом окне (защитный лимит — 365 дней).
	 *
	 * @param {number} startMs - реальный мс
	 * @param {number} workDays - сколько рабочих дней прибавить
	 */
	addWorkDays(startMs, workDays) {
		const rt = this.runtime;
		if (!rt) return null;
		if (workDays <= 0) return startMs;

		const startTsm = strToTsm(this.realMsToScheduleStr(startMs));
		if (startTsm === null) return null;

		// дата создания: сам день считается рабочим, если в нём есть работа.
		// SLA в N рабочих дней от созданной заявки = после N полных рабочих дней
		// от дня создания (включая текущий, если он рабочий).
		let cursorDate = Math.floor(startTsm / MINUTES_IN_DAY) * MINUTES_IN_DAY;
		let counted = 0;
		const safety = 365;
		for (let i = 0; i < safety && counted < workDays; i++) {
			const dayStr = tsmToStr(cursorDate).slice(0, 10);
			if (rt.isWorkDay(dayStr)) counted++;
			if (counted < workDays) cursorDate += MINUTES_IN_DAY;
		}
		if (counted < workDays) return null;

		// Конец рабочего дня = последний интервал.
		const intervals = rt.getDateIntervals(cursorDate);
		if (!intervals.length) return null;
		const lastEndMin = intervals[intervals.length - 1][1];
		const deadlineTsm = cursorDate + lastEndMin;
		return this.scheduleTsmToRealMs(deadlineTsm);
	}
}

export default ScheduleStore;
