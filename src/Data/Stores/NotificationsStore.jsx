import { action, makeObservable, observable } from 'mobx';

/**
 * Всплывающие уведомления ("тосты") — визуальный лог действий приложения.
 *
 * Уровни: success | info | warning | error. У каждого свой срок жизни (TTL);
 * наведение мыши ставит таймер на паузу — чтобы успеть дочитать ошибку.
 * Крестиком можно закрыть вручную. Каждое уведомление дублируется в консоль.
 *
 * Снаружи обычно не используется напрямую — см. Helpers/Notify (notify.error(...)),
 * который доступен и из моделей, где нет доступа к React-контексту.
 */

/** Срок жизни по уровню, мс. 0 — висит до ручного закрытия. */
const DEFAULT_TTL = {
	success: 4000,
	info: 5000,
	warning: 8000,
	error: 15000,
};

/** Сколько уведомлений держим на экране одновременно (старые вытесняются). */
const MAX_VISIBLE = 6;

class NotificationsStore {
	/** Видимые уведомления, в порядке появления (старые первыми). */
	items = [];

	_seq = 0;
	/** id => { timer, deadline, remaining } */
	_timers = new Map();

	constructor() {
		makeObservable(this, {
			items: observable,
			push: action,
			dismiss: action,
			clear: action,
		});
	}

	/**
	 * Показать уведомление.
	 * @param {'success'|'info'|'warning'|'error'} level
	 * @param {string} text основной текст
	 * @param {Object} [opts]
	 * @param {string} [opts.title]  заголовок (жирной строкой над текстом)
	 * @param {number} [opts.ttl]    срок жизни, мс (0 — без автоскрытия)
	 * @returns {number} id уведомления
	 */
	push(level, text, opts = {}) {
		const id = ++this._seq;
		const ttl = opts.ttl ?? DEFAULT_TTL[level] ?? DEFAULT_TTL.info;
		const item = {
			id,
			level,
			title: opts.title ?? null,
			text: String(text ?? ''),
			time: new Date(),
		};

		const log = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
		log('[notify:' + level + ']', item.title ? item.title + ': ' + item.text : item.text);

		this.items.push(item);
		while (this.items.length > MAX_VISIBLE) this._drop(this.items[0].id);

		if (ttl > 0) this._startTimer(id, ttl);
		return id;
	}

	dismiss(id) {
		this._drop(id);
	}

	clear() {
		[...this.items].forEach(i => this._drop(i.id));
	}

	/** Поставить автоскрытие на паузу (курсор над уведомлением). */
	pause(id) {
		const t = this._timers.get(id);
		if (!t || t.timer === null) return;
		clearTimeout(t.timer);
		t.timer = null;
		t.remaining = Math.max(0, t.deadline - Date.now());
	}

	/** Продолжить отсчёт (курсор ушёл). Даём минимум 1.5с, чтобы не пропадало мгновенно. */
	resume(id) {
		const t = this._timers.get(id);
		if (!t || t.timer !== null) return;
		this._startTimer(id, Math.max(t.remaining, 1500));
	}

	_startTimer(id, ms) {
		const timer = setTimeout(() => this.dismiss(id), ms);
		this._timers.set(id, { timer, deadline: Date.now() + ms, remaining: ms });
	}

	_drop(id) {
		const t = this._timers.get(id);
		if (t && t.timer !== null) clearTimeout(t.timer);
		this._timers.delete(id);
		const idx = this.items.findIndex(i => i.id === id);
		if (idx !== -1) this.items.splice(idx, 1);
	}
}

export default NotificationsStore;
