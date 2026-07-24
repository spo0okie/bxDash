import { action, makeObservable, observable, runInAction, when } from 'mobx';

const DEFAULT_POLL_INTERVAL_MS = 60000;

/**
 * DutyStore — текущий дежурный техподдержки глазами телефонии (ast22-phones).
 *
 * Источник — GET /api/v1/duty?schedule=<id> (Bearer, как остальные api/v1):
 * endpoint снимает номер дежурного probe-запросом через сам диалплан, т.е.
 * отдаёт ровно то значение, с которым телефония работает прямо сейчас
 * (см. plans/duty-api.md в ast22-phones). Раньше это же значение приходило
 * WS-событием techSupportShift со старой телефонии (Asterisk 13).
 *
 * - scheduleId — id расписания в ЛОКАЛЬНОЙ таблице schedules ast22-phones
 *   (НЕ inventory_id); 0 = механизм отключён.
 * - Первый опрос — как только ast22 авторизован, дальше по интервалу.
 * - Результат кладётся в users.setDutyPhone() (номер приводится к Number,
 *   как телефоны в userList); null = нерабочее время, никто не подсвечен.
 * - При ошибке опроса (сеть, 502 DUTY_PROBE_FAILED) последнее известное
 *   значение НЕ сбрасывается — транзиентный сбой probe не должен гасить
 *   индикатор; текст ошибки хранится в error для отладки.
 */
class DutyStore {
	main;
	users;
	scheduleId;
	pollIntervalMs;

	/** Когда последний раз успешно опросили (мс), null = ещё ни разу */
	loadedAt = null;

	/** Текст ошибки последней попытки опроса (null = успех) */
	error = null;

	/** Идентификатор setInterval, чтобы можно было его остановить. Не observable. */
	_timer = null;

	constructor(main, users, scheduleId, pollIntervalMs) {
		this.main = main;
		this.users = users;
		this.scheduleId = Number(scheduleId) || 0;
		this.pollIntervalMs = Number(pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS;

		makeObservable(this, {
			loadedAt: observable,
			error: observable,
			setLoaded: action,
			setError: action,
		});

		if (!this.scheduleId) return;

		when(
			() => this.main.ast22.authStatus === 'OK',
			() => {
				this.load();
				this._timer = setInterval(() => this.load(), this.pollIntervalMs);
			},
		);
	}

	dispose() {
		if (this._timer) clearInterval(this._timer);
		this._timer = null;
	}

	setLoaded(dutyPhone) {
		this.loadedAt = Date.now();
		this.error = null;
		this.users.setDutyPhone(dutyPhone);
	}

	setError(error) {
		this.error = error;
	}

	async load() {
		// Авторизация могла слететь между тиками — тихо пропускаем тик,
		// BackendSystem сам переавторизуется.
		if (this.main.ast22.authStatus !== 'OK') return;
		try {
			const response = await this.main.ast22.fetch(`api/v1/duty?schedule=${this.scheduleId}`);
			if (!response.ok) {
				console.warn('[Duty] ast22 duty returned', response.status);
				runInAction(() => this.setError(`HTTP ${response.status}`));
				return;
			}
			const json = await response.json();
			if (!json?.success) {
				console.warn('[Duty] ast22 duty error envelope', json);
				runInAction(() => this.setError(json?.error?.message ?? 'success=false'));
				return;
			}
			// duty: номер строкой; null = нерабочее время (дежурного нет)
			const raw = json.data?.duty;
			const phone = raw === null || raw === undefined || raw === '' ? null : Number(raw);
			runInAction(() => this.setLoaded(Number.isNaN(phone) ? null : phone));
		} catch (error) {
			console.warn('[Duty] ast22 duty fetch failed:', error.message);
			runInAction(() => this.setError(String(error)));
		}
	}
}

export default DutyStore;
