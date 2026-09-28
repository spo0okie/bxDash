/**
 * Глобальная точка вызова всплывающих уведомлений.
 *
 *   import notify from 'Helpers/Notify';
 *   notify.success('Ответственный изменён');
 *   notify.error('Access denied', { title: 'Задача 123 не сохранена' });
 *
 * NotificationsStore инжектится через setStore() в StoreProvider (как у TimeHelper).
 * До инжекта (ранний bootstrap, тесты) — просто пишем в консоль.
 */
class Notify {
	_store = null;

	setStore(store) {
		this._store = store;
	}

	push(level, text, opts) {
		if (this._store) return this._store.push(level, text, opts);
		console.log('[notify:' + level + ']', opts?.title ? opts.title + ': ' + text : text);
		return null;
	}

	success(text, opts) { return this.push('success', text, opts); }
	info(text, opts)    { return this.push('info', text, opts); }
	warning(text, opts) { return this.push('warning', text, opts); }
	error(text, opts)   { return this.push('error', text, opts); }

	/**
	 * Достать человекочитаемое описание ошибки из чего угодно:
	 * Error, JSON-ответа бэка ({error, info}), сырого текста ответа (в т.ч. HTML PHP-ошибки).
	 */
	describe(err) {
		if (err === null || err === undefined) return 'Неизвестная ошибка';
		if (err instanceof Error) return err.message || String(err);
		if (typeof err === 'object') {
			if (err.error) return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
			return JSON.stringify(err).slice(0, 500);
		}
		// сырой текст: вырезаем теги и схлопываем пробелы (PHP fatal приходит HTML'ем)
		const plain = String(err).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
		return plain ? plain.slice(0, 500) : 'Пустой ответ сервера';
	}
}

const notify = new Notify();
export default notify;
