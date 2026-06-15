import { observable, action, computed, makeObservable, reaction, runInAction, get } from 'mobx';

/**
 * Карточка одного звонка или callback-заявки.
 * kind='call'     → активный звонок (входящий/исходящий из ast22 calls)
 * kind='callback' → заявка на обратный звонок (callback_requests)
 *
 * Pipeline: callPolling → userSearching → ready | noUsers | error.
 * Карточка добавляется в стек только после получения данных от ast22.
 */
class IncomingCall {
	store;
	key;                    // ключ для React (kind+id или myPhone+startedAt)
	myPhone;                // номер current user
	startedAt;              // timestamp начала pipeline
	kind;                   // 'call' | 'callback'

	// === observable ===
	phase = 'callPolling';  // 'callPolling' | 'userSearching' | 'ready' | 'noUsers' | 'error'
	call = null;            // {call_uuid, caller_num, callee_num, ...} | callback {id, caller_num, ...}
	direction = null;       // 'incoming' | 'outgoing' | 'callback'
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
			call: observable.ref,
			direction: observable,
			users: observable,
			activeUserId: observable,
			collapsed: observable,
			closed: observable,
			attempts: observable,
			setPhase: action,
			setCall: action,
			setUsers: action,
			setActiveUserId: action,
			setCollapsed: action,
			close: action,
			incAttempts: action,
			otherParty: computed,
			title: computed,
		});
	}

	setPhase(p) { this.phase = p; }
	setCall(c, direction) {
		this.call = c;
		this.direction = direction;
	}
	setUsers(u) {
		this.users = u;
		if (u.length > 0 && this.activeUserId === null) this.activeUserId = u[0].id;
	}
	setActiveUserId(id) { this.activeUserId = id; }
	setCollapsed(value) { this.collapsed = value; }
	close() { this.closed = true; }
	incAttempts() { this.attempts += 1; }

	/** Номер второй стороны: для incoming/callback — caller_num, для outgoing — callee_num. */
	get otherParty() {
		if (!this.call) return null;
		return this.direction === 'outgoing' ? this.call.callee_num : this.call.caller_num;
	}

	get title() {
		if (!this.call) return this.kind === 'callback' ? 'Обратный вызов' : 'Вызов';
		let prefix;
		if (this.kind === 'callback') prefix = '↩ Перезвонить на номер';
		else if (this.direction === 'outgoing') prefix = 'Исходящий вызов на номер';
		else prefix = 'Входящий вызов с номера';
		let t = `${prefix} ${this.otherParty}`;
		if (this.phase === 'noUsers') t += ' — пользователь не найден';
		return t;
	}
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
			this.expandCard(card); // новая карточка разворачивается, остальные сворачиваются
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
	 * Periodic poll списка pending-заявок на обратный звонок.
	 * Для каждой новой заявки (не в стеке и не закрытой ранее) создаёт карточку
	 * с kind='callback'. Дедуп по id заявки.
	 */
	async pollCallbacks() {
		const phone = this.currentUser?.phone;
		if (!phone) return;
		const list = await this.fetchCallbacks(phone);
		if (!list.length) return;

		const existingIds = new Set(
			this.cards
				.filter(c => c.kind === 'callback' && !c.closed)
				.map(c => c.call?.id)
		);

		for (const cb of list) {
			if (!cb?.id) continue;
			if (existingIds.has(cb.id)) continue;
			if (this.dismissedCallbackIds.has(cb.id)) continue;
			this.spawnCallback(cb);
		}
	}

	async fetchCallbacks(myPhone) {
		const ast22 = this.main.ast22;
		const params = new URLSearchParams({
			status: 'pending',
			callee_num: myPhone,
		});
		try {
			const response = await ast22.fetch(`api/v1/callback-requests/search?${params.toString()}`);
			if (response.status === 404) return [];
			if (!response.ok) {
				console.warn('[IncomingCalls] ast22 callback-requests/search returned', response.status);
				return [];
			}
			const json = await response.json();
			return Array.isArray(json?.data) ? json.data : [];
		} catch (e) {
			console.warn('[IncomingCalls] ast22 callback-requests/search fetch failed:', e.message);
			return [];
		}
	}

	/**
	 * Создать карточку для конкретной callback-заявки и сразу запустить
	 * поиск пользователя по caller_num (как в обычном incoming).
	 */
	async spawnCallback(cbRequest) {
		const phone = this.currentUser?.phone;
		if (!phone) return;
		const card = new IncomingCall(this, phone, 'callback');
		card.setCall(cbRequest, 'callback');
		card.setPhase('userSearching');
		this.addCard(card);
		this.expandCard(card);
		try {
			await this.searchUser(card);
		} catch (e) {
			console.error('[IncomingCalls] callback pipeline error:', e);
			if (!card.closed) card.setPhase('error');
		}
	}

	/** Закрытие карточки запоминается, чтобы следующий poll не воскресил её. */
	dismissCard(card) {
		if (card.kind === 'callback' && card.call?.id) {
			this.dismissedCallbackIds.add(card.call.id);
		}
		card.close();
		this.removeCard(card);
	}
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
