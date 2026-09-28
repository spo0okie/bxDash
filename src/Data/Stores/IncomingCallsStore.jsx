import { observable, action, computed, makeObservable, reaction, runInAction, get } from 'mobx';

/**
 * Карточка звонка или ГРУППЫ callback-заявок.
 * kind='call'     → один активный звонок (входящий/исходящий из ast22 calls)
 * kind='callback' → группа заявок на обратный звонок по одному номеру
 *                   (несколько записей, см. records[] + множитель).
 *
 * Pipeline: callPolling → userSearching → ready | noUsers | error.
 * Карточка добавляется в стек только после получения данных от ast22.
 */
class IncomingCall {
	store;
	key;                    // ключ для React
	myPhone;                // номер current user
	startedAt;              // timestamp начала pipeline
	kind;                   // 'call' | 'callback'
	groupKey = null;        // для callback — `${caller_num}/${callee_num}` (ключ группировки)
	groupNumber = null;     // для callback — номер второй стороны (== caller_num при callee=я)

	// === observable ===
	phase = 'callPolling';  // 'callPolling' | 'userSearching' | 'ready' | 'noUsers' | 'error'
	records = [];           // call: [{...call}] (1 шт); callback: [{id, created_at, request_type, ...}] (N шт)
	direction = null;       // 'incoming' | 'outgoing' (только для call)
	users = [];             // [{ id, login, ename, shortName }]
	activeUserId = null;
	collapsed = false;
	closed = false;
	attempts = 0;

	constructor(store, myPhone, kind = 'call') {
		this.store = store;
		this.myPhone = myPhone;
		this.kind = kind;
		this.startedAt = Date.now();
		this.key = `${kind}/${myPhone}/${this.startedAt}`;

		makeObservable(this, {
			phase: observable,
			records: observable.ref,
			direction: observable,
			users: observable,
			activeUserId: observable,
			collapsed: observable,
			closed: observable,
			attempts: observable,
			setPhase: action,
			setCall: action,
			setRecords: action,
			setUsers: action,
			setActiveUserId: action,
			setCollapsed: action,
			close: action,
			incAttempts: action,
			otherParty: computed,
			multiplier: computed,
			earliestTime: computed,
			latestTime: computed,
			voicemails: computed,
			plainRecords: computed,
			allAutoDone: computed,
			title: computed,
		});
	}

	setPhase(p) { this.phase = p; }
	/** Для kind='call': одна запись + направление. */
	setCall(call, direction) {
		this.records = [call];
		this.direction = direction;
	}
	/** Для kind='callback': заменить набор записей группы. */
	setRecords(records) {
		this.records = records;
	}
	setUsers(u) {
		this.users = u;
		if (u.length > 0 && this.activeUserId === null) this.activeUserId = u[0].id;
	}
	setActiveUserId(id) { this.activeUserId = id; }
	setCollapsed(value) { this.collapsed = value; }
	close() { this.closed = true; }
	incAttempts() { this.attempts += 1; }

	/** Номер второй стороны. callback — groupNumber; call — caller/callee по направлению. */
	get otherParty() {
		if (this.kind === 'callback') return this.groupNumber;
		const c = this.records[0];
		if (!c) return null;
		return this.direction === 'outgoing' ? c.callee_num : c.caller_num;
	}

	get multiplier() { return this.records.length; }

	/** Самая ранняя метка времени среди записей (для отображения в шапке). */
	get earliestTime() {
		const times = this.records.map(recordTime).filter(Boolean);
		if (!times.length) return null;
		return times.reduce((a, b) => (a < b ? a : b));
	}

	/** Самая поздняя метка времени среди записей (для позиции карточки в стеке).
	 *  Строки формата "YYYY-MM-DD HH:MM:SS" сравниваются лексикографически = хронологически. */
	get latestTime() {
		const times = this.records.map(recordTime).filter(Boolean);
		if (!times.length) return '';
		return times.reduce((a, b) => (a > b ? a : b));
	}

	get voicemails() { return this.records.filter(r => r.request_type === 'voicemail'); }
	get plainRecords() { return this.records.filter(r => r.request_type !== 'voicemail'); }

	/** Все записи в auto_done — диалплан распознал ответ, ждёт подтверждения оператора (зелёная карточка). */
	get allAutoDone() {
		return this.records.length > 0 && this.records.every(r => r.status === 'auto_done');
	}

	get title() {
		const n = this.otherParty;
		let prefix;
		if (this.kind === 'callback') prefix = '↩ Перезвонить на номер';
		else if (this.direction === 'outgoing') prefix = 'Исходящий вызов на номер';
		else prefix = 'Входящий вызов с номера';
		let t = n ? `${prefix} ${n}` : (this.kind === 'callback' ? 'Обратный вызов' : 'Вызов');
		if (this.phase === 'noUsers') t += ' — пользователь не найден';
		return t;
	}
}

/** Метка времени записи: created_at (callback) или started_at (call). */
function recordTime(r) {
	return r?.created_at || r?.started_at || null;
}

/**
 * Стор управления стеком карточек входящих вызовов.
 *
 * Триггер: phoneStatus у current user переходит в RINGING/INUSE → spawn новой карточки
 * (если для текущего цикла звонка карточки ещё нет — см. логику в reaction).
 */
class IncomingCallsStore {
	main;
	users;
	layout;
	config;

	cards = [];                          // массив IncomingCall в порядке создания
	prevPhoneStatus = null;
	dismissedCallbackIds = new Set();    // id callback-заявок которые пользователь закрыл — не показываем снова
	callbackPollHandle = null;
	idlePollHandle = null;               // отложенный перечит заявок после ухода телефона в IDLE
	busyPollHandle = null;               // отложенный перечит заявок после перехода телефона в BUSY/INUSE

	constructor(main, users, layout, config) {
		this.main = main;
		this.users = users;
		this.layout = layout;
		this.config = config;

		makeObservable(this, {
			cards: observable,
			addCard: action,
			removeCard: action,
			expandCard: action,
			expandBottom: action,
			sortedCards: computed,
		});

		if (!config.enabled) return;

		// Подписка на phoneStatus текущего пользователя.
		// Срабатывает при IDLE→RINGING/INUSE: запускаем новую карточку.
		reaction(
			() => {
				const u = this.currentUser;
				return u ? u.phoneStatus : null;
			},
			(status, prev) => {
				const incoming = status === 'RINGING' || status === 'INUSE';
				const wasIncoming = prev === 'RINGING' || prev === 'INUSE';
				if (incoming && !wasIncoming) {
					this.spawn();
				}
				// Телефон освободился после звонка → через N сек перечитать заявки:
				// по завершённому/пропущенному звонку мог сформироваться callback.
				if (status === 'IDLE' && wasIncoming && config.callbackAfterIdleMs > 0) {
					clearTimeout(this.idlePollHandle);
					this.idlePollHandle = setTimeout(() => this.pollCallbacks(), config.callbackAfterIdleMs);
				}
				// Телефон занялся (INUSE) → через N сек перечитать заявки:
				// callback мог сформироваться ещё во время проигрывания сообщения.
				if (status === 'INUSE' && prev !== 'INUSE' && config.callbackAfterBusyMs > 0) {
					clearTimeout(this.busyPollHandle);
					this.busyPollHandle = setTimeout(() => this.pollCallbacks(), config.callbackAfterBusyMs);
				}
			}
		);

		// Periodic poll callback-заявок (если включено). Первый poll — как только
		// ast22 авторизован, дальше — по интервалу из config.
		if (config.callbackPollIntervalMs > 0) {
			reaction(
				() => this.main.ast22?.authStatus === 'OK' && this.currentUser?.phone,
				ready => {
					if (ready) {
						this.pollCallbacks();
						this.callbackPollHandle = setInterval(
							() => this.pollCallbacks(),
							config.callbackPollIntervalMs
						);
					} else if (this.callbackPollHandle) {
						clearInterval(this.callbackPollHandle);
						this.callbackPollHandle = null;
					}
				},
				{ fireImmediately: true }
			);
		}
	}

	get currentUser() {
		const id = this.users?.current;
		if (!id) return null;
		return get(this.users.items, id) ?? null;
	}

	/** Карточки для отрисовки, отсортированные по latestTime ASC: самая свежая
	 *  активность — внизу стека. Когда у группы появляется новая запись (звонок
	 *  перешёл в заявку), её latestTime растёт и карточка сваливается вниз. */
	get sortedCards() {
		return this.cards.slice().sort((a, b) => {
			const ta = a.latestTime || '';
			const tb = b.latestTime || '';
			if (ta < tb) return -1;
			if (ta > tb) return 1;
			return 0;
		});
	}

	addCard(card) {
		this.cards.push(card);
	}

	removeCard(card) {
		const i = this.cards.indexOf(card);
		if (i !== -1) this.cards.splice(i, 1);
	}

	/** Разворачивает указанную карточку и сворачивает остальные в стеке. */
	expandCard(card) {
		this.cards.forEach(c => c.setCollapsed(c !== card));
	}

	/** Разворачивает самую нижнюю карточку стека (max latestTime) — туда уезжает
	 *  свежая активность. Зовётся при изменениях состава/записей, не на каждый poll. */
	expandBottom() {
		const sorted = this.sortedCards;
		const bottom = sorted[sorted.length - 1];
		if (bottom) this.expandCard(bottom);
	}

	/**
	 * Создать новую карточку и запустить её pipeline.
	 * Карточка добавляется в стек ТОЛЬКО после того как ast22 подтвердил
	 * активный звонок (либо входящий — callee_num=мой, либо исходящий — caller_num=мой).
	 * Если за maxRetries ничего не найдено — карточка тихо отбрасывается
	 * (например ringing-flap без реального звонка).
	 */
	spawn() {
		const user = this.currentUser;
		const phone = user?.phone;
		if (!phone) {
			console.warn('[IncomingCalls] current user phone is empty — skipping');
			return;
		}

		const card = new IncomingCall(this, phone);
		this.runPipeline(card);
	}

	async runPipeline(card) {
		try {
			const found = await this.pollActiveCall(card);
			if (card.closed) return;
			if (!found) return; // ни входящего, ни исходящего за 5 секунд — тихо

			// Учитываем пользовательский переключатель: если этот тип звонков
			// отключён в настройках — карточка не появится.
			if (found.direction === 'incoming' && !this.layout.incomingCallsVisible) return;
			if (found.direction === 'outgoing' && !this.layout.outgoingCallsVisible) return;

			card.setCall(found.call, found.direction);
			card.setPhase('userSearching');
			this.addCard(card);
			this.expandBottom(); // свежая активность внизу стека — её и разворачиваем
			await this.searchUser(card);
		} catch (e) {
			console.error('[IncomingCalls] pipeline error:', e);
			if (!card.closed) {
				card.setPhase('error');
				if (!this.cards.includes(card)) this.addCard(card);
			}
		}
	}

	/**
	 * Polling ast22 параллельно по двум фильтрам:
	 *   callee_num=мой → входящий звонок,
	 *   caller_num=мой → исходящий звонок.
	 * Кто первым вернёт активный звонок — тот и определит направление.
	 * Если в одной попытке вернулись оба — приоритет входящему
	 * (его пользователь обычно ждёт сильнее).
	 */
	async pollActiveCall(card) {
		const { maxRetries, retryDelayMs, stubCallerNum } = this.config;
		if (stubCallerNum) {
			return {
				direction: 'incoming',
				call: {
					call_uuid: `stub-${Date.now()}`,
					caller_num: String(stubCallerNum),
					callee_num: String(card.myPhone),
					status: 'active',
					type: 'incoming',
					started_at: new Date().toISOString(),
				},
			};
		}
		while (card.attempts < maxRetries) {
			if (card.closed) return null;
			card.incAttempts();
			const [asCallee, asCaller] = await Promise.all([
				this.fetchActiveCall({ callee_num: card.myPhone }),
				this.fetchActiveCall({ caller_num: card.myPhone }),
			]);
			if (asCallee) return { direction: 'incoming', call: asCallee };
			if (asCaller) return { direction: 'outgoing', call: asCaller };
			await sleep(retryDelayMs);
		}
		return null;
	}

	async fetchActiveCall(filter) {
		const ast22 = this.main.ast22;
		const params = new URLSearchParams({ status: 'active', ...filter });
		try {
			const response = await ast22.fetch(`api/v1/calls/search?${params.toString()}`);
			if (response.status === 404) return null;
			if (!response.ok) {
				console.warn('[IncomingCalls] ast22 calls/search returned', response.status);
				return null;
			}
			const json = await response.json();
			const list = Array.isArray(json?.data) ? json.data : null;
			return list && list.length ? list[0] : null;
		} catch (e) {
			console.warn('[IncomingCalls] ast22 calls/search fetch failed:', e.message);
			return null;
		}
	}

	/**
	 * Шаг 2: по номеру второй стороны найти пользователей в Inventory.
	 * Без retry (пользователи — менее динамичные данные чем звонки).
	 */
	async searchUser(card) {
		const otherNum = card.otherParty;
		if (!otherNum) {
			card.setPhase('noUsers');
			return;
		}
		const list = await this.fetchUsersByPhone(otherNum);
		if (card.closed) return;
		if (!list || list.length === 0) {
			runInAction(() => {
				card.users = [];
				card.setPhase('noUsers');
			});
			return;
		}
		const users = list.map(mapInventoryUser).filter(u => u.id);
		runInAction(() => {
			card.setUsers(users);
			card.setPhase('ready');
		});
	}

	async fetchUsersByPhone(num) {
		const inv = this.main.inventory;
		try {
			const response = await inv.fetch(`api/phones/filter-by-num?num=${encodeURIComponent(num)}`);
			if (response.status === 404) return [];
			if (!response.ok) {
				console.warn('[IncomingCalls] inventory phones/filter-by-num returned', response.status);
				return [];
			}
			const data = await response.json();
			return Array.isArray(data) ? data : [];
		} catch (e) {
			console.warn('[IncomingCalls] inventory phones/filter-by-num failed:', e.message);
			return [];
		}
	}

	// ====================== Callback-заявки ======================

	/**
	 * Periodic poll pending-заявок на обратный звонок.
	 * Группирует записи по паре caller_num/callee_num и сверяет со стеком:
	 *  - новая группа → создаёт карточку kind='callback';
	 *  - существующая → обновляет набор записей (server = источник правды);
	 *  - исчезнувшая (все закрыты/dismissed) → убирает карточку.
	 * Локально закрытые записи (dismissedCallbackIds) в расчёт не берём.
	 */
	async pollCallbacks() {
		const phone = this.currentUser?.phone;
		if (!phone) return;
		const list = await this.fetchCallbacks(phone);
		const fresh = list.filter(cb => cb?.id && !this.dismissedCallbackIds.has(cb.id));

		// Сигнатура стека (состав + новизна записей) — чтобы развернуть нижнюю
		// карточку только когда что-то реально изменилось, не на каждый poll.
		const sig = () => this.cards
			.map(c => `${c.key}:${c.records.map(r => r.id ?? r.call_uuid).join(',')}`)
			.sort().join('|');
		const before = sig();

		// Группировка по (кто → кому → статус). Статус в ключе разделяет
		// pending и auto_done по одному номеру в разные карточки, чтобы
		// пред-выполненные (зелёные) не смешивались с открытыми (оранжевыми).
		const groups = new Map();
		for (const cb of fresh) {
			const key = `${cb.caller_num}/${cb.callee_num}/${cb.status}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(cb);
		}

		for (const [key, recs] of groups) {
			const sorted = recs.slice().sort((a, b) => (recordTime(a) < recordTime(b) ? -1 : 1));
			const existing = this.cards.find(c => c.kind === 'callback' && !c.closed && c.groupKey === key);
			if (existing) {
				existing.setRecords(sorted);
			} else {
				this.spawnCallbackGroup(phone, key, recs[0].caller_num, sorted);
			}
		}

		// Убрать карточки-группы, которых больше нет на сервере (или все dismissed).
		const liveKeys = new Set(groups.keys());
		this.cards
			.filter(c => c.kind === 'callback' && !c.closed && !liveKeys.has(c.groupKey))
			.slice()
			.forEach(c => this.removeCard(c));

		// Дедуп: если по этому звонку (call_uuid) уже сформирована заявка на
		// обратный вызов — отдельная карточка пропущенного звонка не нужна
		// (тот же iframe). Убираем её, инфо о звонке есть в callback-заявке.
		const callbackCallUuids = new Set(fresh.map(cb => cb.call_uuid).filter(Boolean));
		this.cards
			.filter(c => c.kind === 'call' && !c.closed && callbackCallUuids.has(c.records[0]?.call_uuid))
			.slice()
			.forEach(c => this.removeCard(c));

		// Изменился состав/записи — развернуть нижнюю (самую свежую) карточку.
		if (sig() !== before) this.expandBottom();
	}

	/** Грузим заявки в обоих «открытых» статусах: pending и auto_done. */
	async fetchCallbacks(myPhone) {
		const [pending, autoDone] = await Promise.all([
			this.fetchCallbacksByStatus(myPhone, 'pending'),
			this.fetchCallbacksByStatus(myPhone, 'auto_done'),
		]);
		return [...pending, ...autoDone];
	}

	async fetchCallbacksByStatus(myPhone, status) {
		const ast22 = this.main.ast22;
		const params = new URLSearchParams({ status, callee_num: myPhone });
		try {
			const response = await ast22.fetch(`api/v1/callback-requests/search?${params.toString()}`);
			if (response.status === 404) return []; // штатно — заявок такого статуса нет
			if (!response.ok) {
				console.warn('[IncomingCalls] ast22 callback-requests/search returned', response.status);
				return [];
			}
			const json = await response.json();
			// Формат: { success, data: { items: [...], pagination: {...} } }
			return Array.isArray(json?.data?.items) ? json.data.items : [];
		} catch (e) {
			console.warn('[IncomingCalls] ast22 callback-requests/search fetch failed:', e.message);
			return [];
		}
	}

	/**
	 * Создать карточку-группу для callback-заявок одного номера и запустить
	 * поиск пользователя по этому номеру (как в обычном incoming).
	 */
	spawnCallbackGroup(phone, key, number, records) {
		const card = new IncomingCall(this, phone, 'callback');
		card.groupKey = key;
		card.groupNumber = number;
		card.setRecords(records);
		card.setPhase('userSearching');
		this.addCard(card);
		// Разворот нижней карточки делает pollCallbacks после всей реконсиляции.
		this.searchUser(card).catch(e => {
			console.error('[IncomingCalls] callback group pipeline error:', e);
			if (!card.closed) card.setPhase('error');
		});
	}

	/** Закрытие карточки запоминается, чтобы следующий poll не воскресил её. */
	dismissCard(card) {
		if (card.kind === 'callback') {
			card.records.forEach(r => { if (r.id) this.dismissedCallbackIds.add(r.id); });
		}
		card.close();
		this.removeCard(card);
	}

	/**
	 * Перевести auto_done-записи карточки в done на сервере (подтверждение
	 * оператора). Если PUT API ещё не выкачен — мягко деградирует (404),
	 * локальный dismiss всё равно уберёт карточку на сессию.
	 */
	async markCallbacksDone(card) {
		const ids = card.records
			.filter(r => r.status === 'auto_done' && r.id)
			.map(r => r.id);
		await Promise.all(ids.map(id => this.putCallbackStatus(id, 'done')));
	}

	async putCallbackStatus(id, status) {
		try {
			const response = await this.main.ast22.fetch(`api/v1/callback-requests/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status }),
			});
			if (!response.ok) {
				console.warn('[IncomingCalls] ast22 callback PUT returned', response.status);
			}
		} catch (e) {
			console.warn('[IncomingCalls] ast22 callback PUT failed:', e.message);
		}
	}

	/**
	 * Изменить номер обратного вызова записи (в голосовом мог быть надиктован
	 * другой номер). Сервер — источник правды: запись в card.records заменяется
	 * данными из ответа. Ошибки — throw, показ на совести UI.
	 */
	async updateCallbackNum(card, record, num) {
		const json = await this.ast22Json(`api/v1/callback-requests/${record.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ callback_num: num }),
		});
		card.setRecords(card.records.map(r => (r.id === record.id ? { ...r, ...json.data } : r)));
	}

	/**
	 * Click-to-call через ast22: сначала звонит аппарат оператора, после снятия
	 * трубки штатный диалплан набирает toNum. Запись в calls, трасса callees и
	 * авто-закрытие заявки (auto_done) отрабатывают как при ручном наборе, так
	 * что локально после originate ничего менять не нужно — следующий poll
	 * (в т.ч. хук after-busy) подтянет актуальные статусы.
	 */
	async originateCall(toNum) {
		const from = this.currentUser?.phone;
		if (!from) throw new Error('У текущего пользователя не задан внутренний номер');
		const to = dialableNum(toNum);
		if (!to) throw new Error(`Номер ${toNum} нельзя набрать`);
		return (await this.ast22Json('api/v1/calls/originate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ from, to }),
		})).data;
	}

	/**
	 * Запрос к ast22 c разбором конверта {success, data | error:{message}}.
	 * Не-2xx или success=false → Error с серверным сообщением.
	 */
	async ast22Json(url, options) {
		const response = await this.main.ast22.fetch(url, options);
		const json = await response.json().catch(() => null);
		if (!response.ok || !json?.success) {
			// 422 от ast22: {error:{message:'Ошибка валидации', details:{field:[...]}}}
			// — общий message неинформативен, добавляем тексты по полям.
			const details = json?.error?.details;
			const detailText = details && typeof details === 'object'
				? Object.values(details).flat().join('; ')
				: '';
			const msg = [json?.error?.message || json?.message, detailText].filter(Boolean).join(': ');
			throw new Error(msg || `Ошибка запроса (HTTP ${response.status})`);
		}
		return json;
	}
}

/**
 * Номер → вид, пригодный для набора через ast22 originate (только цифры).
 * Российский +7XXXXXXXXXX / 7XXXXXXXXXX → 8XXXXXXXXXX — так номер набирает
 * оператор с аппарата, и так его сопоставляет с заявкой диалплан
 * (mark_callback_attempted нормализует 7/8). Прочее — просто без не-цифр.
 */
function dialableNum(num) {
	const digits = String(num || '').replace(/\D/g, '');
	if (digits.length === 11 && digits[0] === '7') return '8' + digits.slice(1);
	return digits.length >= 2 ? digits : '';
}

function mapInventoryUser(data) {
	const ename = data.Ename || data.ename || '';
	return {
		id: Number(data.id),
		login: data.Login || data.login,
		ename,
		shortName: buildShortName(ename),
	};
}

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

/**
 * "Иванов Иван Иванович" → "Иванов И.И."
 * Если отчества нет — "Иванов И."; если есть только фамилия — "Иванов".
 */
function buildShortName(ename) {
	if (!ename) return '';
	const parts = ename.trim().split(/\s+/);
	const [last, first, middle] = parts;
	let s = last || '';
	if (first) s += ' ' + first[0].toUpperCase() + '.';
	if (middle) s += middle[0].toUpperCase() + '.';
	return s;
}

export { IncomingCall };
export default IncomingCallsStore;
