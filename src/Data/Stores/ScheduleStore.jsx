import { action, computed, makeObservable, observable, runInAction, when } from 'mobx';
import { ScheduleRuntime, strToTsm, tsmToStr, MS_IN_MINUTE, MINUTES_IN_DAY } from 'Vendor/scheduleRuntime/scheduleRuntime';

/**
 * Фоллбэк-расписание (структура compiled_json без обращения к Inventory).
 * Используется до загрузки реального расписания и если оно недоступно:
 *   пн-пт 09:00-18:00, сб/вс — выходной, праздничных дней нет.
 *
 * tz_shift_tsm = 180 минут (UTC+3, MSK) — приложение работает в МСК.
 */
const FALLBACK_COMPILED = Object.freeze({
	tz: 'Europe/Moscow',
	tz_shift_tsm: 180,
	main: {
		name: 'fallback (Mon-Fri 09:00-18:00)',
		start: null, start_tsm: null,
		end: null, end_tsm: null,
		default: { schedule: '09:00-18:00', intervals: [[540, 1080, {}]] },
		weekdays: {
			'6': { schedule: '-', intervals: [] },
			'7': { schedule: '-', intervals: [] },
		},
		dates: {},
		periods: [],
	},
	overrides: [],
});

const RELOAD_INTERVAL_MS = 5 * 60 * 1000;

/**
 * ScheduleStore — держит compiled_json рабочего расписания из Inventory
 * и предоставляет ScheduleRuntime для расчётов SLA.
 *
 * - До загрузки или при отсутствии расписания работает фоллбэк (пн-пт 09-18).
 * - После успешной загрузки `compiled` подменяется на полученный JSON;
 *   `runtime` — computed, поэтому все потребители (computed-поля моделей,
 *   observer-компоненты) автоматически пересчитают свои значения.
 * - Раз в 5 минут расписание перетягивается. Если JSON не изменился — observable
 *   не трогаем (нет лишних реактивных пересчётов); если изменился — заменяем,
 *   и зависящие SLA-вычисления пересчитываются.
 */
class ScheduleStore {
	main;
	scheduleId;

	/** @type {Object|null} compiled_json из Inventory; null = используем фоллбэк */
	compiled = null;

	/** Когда последний раз успешно загрузили (мс), null = ещё не загружали */
	loadedAt = null;

	/** Текст ошибки последней попытки загрузки (для отладки) */
	error = null;

	/** Сырое JSON-тело compiled_json для дешёвого сравнения «изменилось/нет». Не observable. */
	_compiledRaw = null;
	/** Идентификатор setInterval, чтобы можно было его остановить. */
	_reloadTimer = null;

	constructor(main, scheduleId) {
		this.main = main;
		this.scheduleId = Number(scheduleId) || 0;

		makeObservable(this, {
			compiled: observable.ref,
			loadedAt: observable,
			error: observable,
			runtime: computed,
			hasLoadedSchedule: computed,
			tzShiftMin: computed,
			setCompiled: action,
			setError: action,
		});

		if (!this.scheduleId) return;

		when(
			() => this.main.inventory.availability === 'OK' && this.main.inventory.authStatus === 'OK',
			() => {
				this.load();
				this._reloadTimer = setInterval(() => this.load(), RELOAD_INTERVAL_MS);
			},
		);
	}

	dispose() {
		if (this._reloadTimer) clearInterval(this._reloadTimer);
		this._reloadTimer = null;
	}

	setCompiled(compiled) {
		this.compiled = compiled;
		this.loadedAt = Date.now();
		this.error = null;
	}

	setError(error) {
		this.error = error;
	}

	/**
	 * @returns {ScheduleRuntime} Активный рантайм. До загрузки — поверх фоллбэка.
	 *  Computed: новый инстанс создаётся только при изменении `compiled`,
	 *  потребители (computed-поля моделей, observer-ы) видят новое значение
	 *  и пересчитываются автоматически.
	 */
	get runtime() {
		return new ScheduleRuntime(this.compiled ?? FALLBACK_COMPILED);
	}

	get hasLoadedSchedule() {
		return this.compiled !== null;
	}

	/** Минуты сдвига часового пояса расписания относительно UTC. */
	get tzShiftMin() {
		const v = (this.compiled ?? FALLBACK_COMPILED).tz_shift_tsm;
		return typeof v === 'number' ? v : 0;
	}

	/**
	 * Преобразует «реальный» Unix-timestamp (мс) в строку 'YYYY-MM-DD HH:MM',
	 * которую ScheduleRuntime интерпретирует как UTC.
	 *
	 * compiled_json хранит даты как «локальное TZ, упакованное в UTC-минуты»
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
	 * Прибавляет к startMs N рабочих дней по расписанию и возвращает реальный мс-таймстамп.
	 *
	 * Модель: SLA 2 рабочих дня = 48 часов wall-clock, в которых нерабочие
	 * календарные дни «не идут» (стрелка часов на них замирает).
	 *
	 * Пример: тикет создан в чт 15:30, SLA 2 рабочих дня:
	 *   - кусок чт (15:30 → 24:00) = 8ч30м
	 *   - вся пт = 24ч
	 *   - сб/вс пропускаются
	 *   - кусок пн (00:00 → 15:30) = 15ч30м
	 *   итого 48ч, дедлайн = пн 15:30.
	 *
	 * Если день — рабочий (рассчитывается через runtime.isWorkDay), он засчитывается
	 * как 24ч независимо от рабочих интервалов внутри. Если нерабочий — целиком пропускается.
	 *
	 * @param {number} startMs - реальный мс
	 * @param {number} workDays - сколько рабочих дней (по 24ч) прибавить
	 * @returns {number|null} мс или null
	 */
	addWorkDays(startMs, workDays) {
		const rt = this.runtime;
		if (!rt) return null;
		if (workDays <= 0) return startMs;

		const startTsm = strToTsm(this.realMsToScheduleStr(startMs));
		if (startTsm === null) return null;

		let remaining = workDays * MINUTES_IN_DAY;
		let cursor = startTsm;
		const safety = 365;
		for (let i = 0; i < safety && remaining > 0; i++) {
			const dayStart = Math.floor(cursor / MINUTES_IN_DAY) * MINUTES_IN_DAY;
			const dayEnd = dayStart + MINUTES_IN_DAY;
			const dayStr = tsmToStr(dayStart).slice(0, 10);
			if (rt.isWorkDay(dayStr)) {
				const consume = Math.min(remaining, dayEnd - cursor);
				cursor += consume;
				remaining -= consume;
			} else {
				cursor = dayEnd;
			}
		}
		if (remaining > 0) return null;
		return this.scheduleTsmToRealMs(cursor);
	}

	/**
	 * Считает рабочее wall-clock время в мс между двумя моментами,
	 * пропуская нерабочие сутки целиком (та же модель, что в addWorkDays).
	 *
	 * Используется для закрытых тикетов: «сколько рабочего времени прошло
	 * от создания до закрытия». Час, проведённый на работе в субботу
	 * (в день, помеченный как нерабочий), не считается; час во вторник
	 * считается как 60 минут.
	 *
	 * @param {number} fromMs - реальный мс начала интервала
	 * @param {number} toMs - реальный мс конца интервала
	 * @returns {number} мс рабочего времени; 0 при некорректных аргументах
	 */
	workMsBetween(fromMs, toMs) {
		const rt = this.runtime;
		if (!rt) return 0;
		if (fromMs == null || toMs == null || toMs <= fromMs) return 0;

		const startTsm = strToTsm(this.realMsToScheduleStr(fromMs));
		const endTsm = strToTsm(this.realMsToScheduleStr(toMs));
		if (startTsm === null || endTsm === null) return 0;

		let cursor = startTsm;
		let workMin = 0;
		// Старые заявки могут жить несколько лет: считаем весь конечный интервал.
		const safety = Math.ceil((endTsm - startTsm) / MINUTES_IN_DAY) + 1;
		for (let i = 0; i < safety && cursor < endTsm; i++) {
			const dayStart = Math.floor(cursor / MINUTES_IN_DAY) * MINUTES_IN_DAY;
			const dayEnd = dayStart + MINUTES_IN_DAY;
			const dayStr = tsmToStr(dayStart).slice(0, 10);
			const segmentEnd = Math.min(dayEnd, endTsm);
			if (rt.isWorkDay(dayStr)) {
				workMin += segmentEnd - cursor;
			}
			cursor = segmentEnd;
		}
		return workMin * MS_IN_MINUTE;
	}

	/**
	 * Считает количество нерабочих календарных дней в интервале [fromMs..toMs]
	 * (обе границы считаются по дате в часовом поясе расписания).
	 *
	 * Используется для подсказки в карточке тикета: "сколько выходных/праздников
	 * пришлось на период от создания тикета до крайнего срока SLA".
	 *
	 * @param {number} fromMs - нижняя граница (реальный мс)
	 * @param {number} toMs - верхняя граница (реальный мс)
	 * @returns {number} количество нерабочих дней
	 */
	countNonWorkDays(fromMs, toMs) {
		const rt = this.runtime;
		if (!rt) return 0;
		if (toMs == null || fromMs == null || toMs < fromMs) return 0;

		const fromStr = this.realMsToScheduleStr(fromMs).slice(0, 10);
		const toStr = this.realMsToScheduleStr(toMs).slice(0, 10);
		const startTsm = strToTsm(fromStr);
		const endTsm = strToTsm(toStr);
		if (startTsm === null || endTsm === null) return 0;

		let cursor = startTsm;
		let count = 0;
		const safety = 366;
		let i = 0;
		while (cursor <= endTsm && i < safety) {
			const dayStr = tsmToStr(cursor).slice(0, 10);
			if (!rt.isWorkDay(dayStr)) count++;
			cursor += MINUTES_IN_DAY;
			i++;
		}
		return count;
	}

	async load() {
		if (!this.scheduleId) return;
		try {
			const response = await this.main.inventory.fetch(`api/schedules/${this.scheduleId}`);
			if (!response.ok) {
				console.error('ScheduleStore: load failed', response.status, response.statusText);
				runInAction(() => this.setError(`HTTP ${response.status}`));
				return;
			}
			const data = await response.json();
			let compiled = data?.compiled_json ?? null;
			if (typeof compiled === 'string') {
				try { compiled = JSON.parse(compiled); }
				catch (e) { console.error('ScheduleStore: compiled_json parse error', e); compiled = null; }
			}
			if (!compiled || !compiled.main) {
				runInAction(() => this.setError('compiled_json пуст или некорректен'));
				return;
			}
			const newRaw = JSON.stringify(compiled);
			if (newRaw === this._compiledRaw) return; // не изменилось — реактивный мир не дёргаем
			this._compiledRaw = newRaw;
			runInAction(() => this.setCompiled(compiled));
		} catch (error) {
			console.error('ScheduleStore: load error', error);
			runInAction(() => this.setError(String(error)));
		}
	}
}

export default ScheduleStore;
