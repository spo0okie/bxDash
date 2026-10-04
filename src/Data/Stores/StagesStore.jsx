import { observable, action, computed, makeObservable, values, when } from 'mobx';
import notify from 'Helpers/Notify';
import TimeHelper from 'Helpers/TimeHelper';
import { bxJson, bxPostJson } from 'Helpers/BxJson';
import { dashItemsSort, dashClosedItemsSort } from 'Helpers/SortHelper';
import { STAGE_ITEM_TYPES } from 'Data/itemTypes';
import { toStacks, fromStacks, moveInStacks } from 'Helpers/StageStacks';

/** Общий пустой список — чтобы observer'ы не перерисовывались из-за нового [] на каждый вызов */
const NO_STAGES = Object.freeze([]);

/**
 * Строка бэка {ID, USER_ID, TITLE, SORT, COLOR, IS_DEFAULT, STACKED} → объект стадии фронта.
 * stacked — столбец стоит под предыдущим, в одной вертикальной стопке с ним (см. Helpers/StageStacks).
 */
export function stageFromRow(row) {
	return {
		id: Number(row.ID),
		userId: Number(row.USER_ID),
		title: String(row.TITLE ?? ''),
		sort: Number(row.SORT),
		color: row.COLOR || null,
		isDefault: row.IS_DEFAULT === 'Y',
		stacked: row.STACKED === 'Y',
	};
}

const bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id);

/**
 * Столбцы (стадии) персональных канбан-досок. См. plans/bucket_columns.md
 *
 * У каждого пользователя свой набор столбцов; ровно один из них — «по умолчанию»,
 * в нём лежит всё, что явно никуда не привязано. Привязки элементов хранятся в самих
 * элементах (DashItem.stages), здесь — только столбцы и раскладка элементов по ним (board).
 *
 * Где бэкенд хранит столбцы, фронт не знает: работаем только с REST stage/*.
 */
class StagesStore {
	main;
	users;
	items;
	layout;
	time;

	/** userId → Stage[] (по возрастанию sort). Массив заменяется целиком. */
	byUser = observable.map({}, { deep: false });

	/** Пользователи, чьи столбцы уже запрошены (в т.ч. неудачно) — чтобы рендер не плодил запросы */
	requested = new Set();

	constructor(main, users, items, layout, time) {
		this.main = main;
		this.users = users;
		this.items = items;
		this.layout = layout;
		this.time = time;
		// элементы достают стор через свой context (DashItem.stageFor)
		if (items) items.stages = this;

		makeObservable(this, {
			byUser: observable,
			setStages: action,
			patchItems: action,
			owner: computed,
			board: computed,
		});
	}

	// ==================== Чтение ====================

	/** Заменить список столбцов пользователя */
	setStages(userId, stages) {
		this.byUser.set(Number(userId), stages.slice().sort(bySort));
	}

	/** Загружены ли столбцы пользователя */
	isLoaded(userId) {
		return this.byUser.has(Number(userId));
	}

	/**
	 * Столбцы пользователя. При первом обращении запускает загрузку и возвращает пустой список;
	 * когда данные придут, наблюдатели перерисуются.
	 */
	stagesOf(userId) {
		userId = Number(userId);
		if (!userId) return NO_STAGES;
		this.ensure(userId);
		return this.byUser.get(userId) ?? NO_STAGES;
	}

	/**
	 * Столбцы пользователя БЕЗ запуска загрузки: null, если ещё не загружены.
	 * Для мест, где запрос по каждому чиху не нужен (контекстное меню карточек в календаре):
	 * загрузку там запускают явно через ensure() при открытии меню.
	 */
	peek(userId) {
		return this.byUser.get(Number(userId)) ?? null;
	}

	/** Столбец по умолчанию (null, пока столбцы не загружены) */
	defaultStageOf(userId) {
		return this.stagesOf(userId).find(stage => stage.isDefault) ?? null;
	}

	/** Есть ли у пользователя столбец с таким id */
	hasStage(userId, stageId) {
		return this.stagesOf(userId).some(stage => stage.id === stageId);
	}

	/** Столбцы пользователя, собранные в стопки: ряд стопок слева направо, в стопке — сверху вниз */
	stacksOf(userId) {
		return toStacks(this.stagesOf(userId));
	}

	/** Столбец по id среди всех загруженных */
	stageById(stageId) {
		stageId = Number(stageId);
		for (const stages of this.byUser.values()) {
			const found = stages.find(stage => stage.id === stageId);
			if (found) return found;
		}
		return null;
	}

	/** Запросить столбцы пользователя, если ещё не запрашивали */
	ensure(userId) {
		if (this.requested.has(userId)) return;
		this.requested.add(userId);
		// вызывается из computed/рендера — сам запрос уводим из текущего стека,
		// чтобы не создавать реакции (when) внутри вычисления
		Promise.resolve().then(() => this.load(userId));
	}

	/**
	 * Загрузить столбцы пользователя с бэка.
	 * @returns {Promise<boolean>} удалось ли
	 */
	load(userId) {
		userId = Number(userId);
		this.requested.add(userId);
		return when(() => this.main.bx.authStatus === 'OK')
			.then(() => bxJson(this.main.bx, 'stage/list/' + userId + '?random=' + TimeHelper.getTimestamp()))
			.then(rows => {
				if (!Array.isArray(rows)) throw new Error('Некорректный ответ сервера: ' + notify.describe(rows));
				this.setStages(userId, rows.map(stageFromRow));
				return true;
			})
			.catch(error => {
				console.error(error);
				notify.error(notify.describe(error), { title: 'Столбцы доски не загружены' });
				return false;
			});
	}

	// ==================== Доска ====================

	/** Чья доска показывается: выбранный пользователь (канбан есть только в персональном режиме) */
	get owner() {
		const selected = this.users?.selected;
		return selected === null || selected === undefined ? null : Number(selected);
	}

	/**
	 * Раскладка элементов владельца доски по столбцам — ОДИН проход по всем элементам.
	 * Столбцы только читают свою долю (тот же принцип, что PeriodItem.itemsByUser).
	 *
	 *   byStage: Map(stageId → открытые элементы, отсортированные как в ячейке календаря)
	 *   closed:  закрытые элементы в пределах загруженной истории
	 *
	 * Видимость типов (tasksVisible и т.п.) здесь не учитывается — её применяют карточки.
	 */
	get board() {
		const byStage = new Map();
		const closed = [];
		const owner = this.owner;
		if (owner === null) return { byStage, closed };

		this.stagesOf(owner).forEach(stage => byStage.set(stage.id, []));
		const accomplicesVisible = this.layout?.accomplicesVisible;
		const historyFrom = this.time.firstWeekStart();

		STAGE_ITEM_TYPES.forEach(type => {
			const store = this.items?.[type];
			if (!store) return;
			values(store.items).forEach(item => {
				const own = item.user === owner;
				// чужие задачи, где владелец доски — соисполнитель (как в календаре)
				const helps = !own && accomplicesVisible && (item.accomplices ?? []).includes(owner);
				if (!own && !helps) return;
				void item.sorting;	// явная зависимость для пересортировки

				if (item.isClosed) {
					if (item.t !== null && item.t >= historyFrom) closed.push(item);
					return;
				}
				const list = byStage.get(item.stageFor(owner));
				if (list) list.push(item);	// списка нет только пока столбцы не загружены
			});
		});

		byStage.forEach(list => list.sort((a, b) => dashItemsSort(b, a)));
		closed.sort((a, b) => dashClosedItemsSort(b, a));
		return { byStage, closed };
	}

	// ==================== Изменение ====================

	/**
	 * Создать столбец.
	 * @returns {Promise<Object|null>} созданная стадия или null при ошибке
	 */
	create(userId, title, color = null) {
		userId = Number(userId);
		return bxPostJson(this.main.bx, 'stage/create', { user: userId, title, color })
			.then(data => {
				const stage = stageFromRow(data.stage);
				this.setStages(userId, [...this.stagesOf(userId).filter(s => s.id !== stage.id), stage]);
				this.broadcast(userId);
				notify.success('Столбец «' + stage.title + '» создан');
				return stage;
			})
			.catch(error => {
				console.error(error);
				notify.error(notify.describe(error), { title: 'Столбец не создан' });
				return null;
			});
	}

	/**
	 * Изменить столбец: fields — любое подмножество {title, color, sort}.
	 * Локально меняем сразу, при ошибке откатываемся к состоянию бэка.
	 * @returns {Promise<boolean>}
	 */
	update(stageId, fields) {
		const stage = this.stageById(stageId);
		if (!stage) {
			notify.error('Столбец ' + stageId + ' не найден', { title: 'Столбец не изменён' });
			return Promise.resolve(false);
		}
		const userId = stage.userId;
		const replace = next => this.setStages(userId, this.stagesOf(userId).map(s => (s.id === stage.id ? next : s)));

		replace({ ...stage, ...fields });
		return bxPostJson(this.main.bx, 'stage/update/' + stage.id, fields)
			.then(data => {
				replace(stageFromRow(data.stage));
				this.broadcast(userId);
				return true;
			})
			.catch(error => {
				console.error(error);
				notify.error(notify.describe(error), { title: 'Столбец «' + stage.title + '» не изменён' });
				this.load(userId);
				return false;
			});
	}

	/**
	 * Удалить столбец. Его элементы переезжают в moveTo (null — в столбец по умолчанию).
	 * @returns {Promise<boolean>}
	 */
	remove(stageId, moveTo = null) {
		const stage = this.stageById(stageId);
		if (!stage) {
			notify.error('Столбец ' + stageId + ' не найден', { title: 'Столбец не удалён' });
			return Promise.resolve(false);
		}
		const userId = stage.userId;
		return bxPostJson(this.main.bx, 'stage/delete/' + stage.id, moveTo ? { moveTo } : {})
			.then(data => {
				const movedTo = Number(data.movedTo);
				this.patchItems(userId, stage.id, movedTo);
				const before = this.stagesOf(userId);
				const index = before.findIndex(s => s.id === stage.id);
				// удалён верхний столбец стопки — следующий занимает его место (бэкенд делает то же)
				const promote = !stage.stacked && before[index + 1]?.stacked ? before[index + 1].id : null;
				// соседи удалённого по стопке снова делят высоту поровну
				this.layout?.resetKanbanHeights?.((toStacks(before).find(stack => stack.includes(stage)) ?? []).map(s => s.id));
				this.setStages(userId, before
					.filter(s => s.id !== stage.id)
					.map(s => (s.id === promote ? { ...s, stacked: false } : s)));
				this.broadcast(userId, { removed: stage.id, movedTo });
				notify.success('Столбец «' + stage.title + '» удалён');
				return true;
			})
			.catch(error => {
				console.error(error);
				notify.error(notify.describe(error), { title: 'Столбец «' + stage.title + '» не удалён' });
				return false;
			});
	}

	/**
	 * Задать порядок столбцов пользователя: ids — id слева направо (внутри стопки — сверху вниз).
	 * stacked — id столбцов, стоящих под предыдущим; null — раскладку по стопкам не трогаем.
	 * @returns {Promise<boolean>}
	 */
	reorder(userId, ids, stacked = null) {
		userId = Number(userId);
		const position = new Map(ids.map((id, index) => [Number(id), index]));
		const rank = stage => (position.has(stage.id) ? position.get(stage.id) : ids.length);

		// локально: перечисленные — вперёд в заданном порядке, остальные сохраняют взаимный порядок
		const local = this.stagesOf(userId)
			.slice()
			.sort((a, b) => (rank(a) - rank(b)) || bySort(a, b))
			.map((stage, index) => ({
				...stage,
				sort: (index + 1) * 100,
				stacked: stacked === null ? stage.stacked : stacked.includes(stage.id),
			}));
		this.setStages(userId, local);

		return bxPostJson(this.main.bx, 'stage/reorder', stacked === null ? { user: userId, ids } : { user: userId, ids, stacked })
			.then(data => {
				// Бэкенд старого образца параметр stacked молча игнорирует и поле STACKED не отдаёт —
				// стопка на экране собралась бы и тут же рассыпалась без объяснений. Говорим об этом явно.
				if (stacked !== null && data.stages.some(row => row.STACKED === undefined)) {
					notify.error(
						'Бэкенд не сохраняет раскладку столбцов по стопкам: на портале старая версия back/app (нужны controller_stage.php и models/stages_provider*.php)',
						{ title: 'Стопка не сохранена' },
					);
				}
				this.setStages(userId, data.stages.map(stageFromRow));
				this.broadcast(userId);
				return true;
			})
			.catch(error => {
				console.error(error);
				notify.error(notify.describe(error), { title: 'Порядок столбцов не сохранён' });
				this.load(userId);
				return false;
			});
	}

	/**
	 * Разложить столбцы пользователя по стопкам: stacks — массив стопок, в каждой id сверху вниз.
	 * @returns {Promise<boolean>}
	 */
	arrange(userId, stacks) {
		const { ids, stacked } = fromStacks(stacks);
		return this.reorder(userId, ids, stacked);
	}

	/**
	 * Столбец перетащили на другой: edge — к какому краю цели его положили.
	 * top / bottom — в ту же стопку над / под целью, left / right — отдельной стопкой рядом.
	 * @returns {Promise<boolean>} false — перенос ничего не меняет, невозможен или бэк отказал
	 */
	dropStage(stageId, targetId, edge) {
		const stage = this.stageById(stageId);
		const target = this.stageById(targetId);
		if (!stage || !target || stage.userId !== target.userId) return Promise.resolve(false);
		const current = this.stacksOf(stage.userId).map(stack => stack.map(s => s.id));
		const next = moveInStacks(current, stage.id, target.id, edge);
		if (!next) return Promise.resolve(false);
		// Веса высот подобраны под прежний состав стопок. В стопке, откуда столбец ушёл, и в той,
		// куда пришёл, границы теперь другие — там высота снова делится поровну.
		const affected = [
			...(current.find(stack => stack.includes(stage.id)) ?? []),
			...(next.find(stack => stack.includes(stage.id)) ?? []),
		];
		this.layout?.resetKanbanHeights?.(affected);
		return this.arrange(stage.userId, next);
	}

	// ==================== Синхронизация ====================

	/**
	 * После удаления столбца перевесить его элементы локально (бэкенд это уже сделал).
	 * Привязка к столбцу по умолчанию хранится как отсутствие привязки.
	 */
	patchItems(userId, fromStage, toStage) {
		const def = this.byUser.get(userId)?.find(stage => stage.isDefault);
		const target = !toStage || (def && def.id === toStage) ? null : toStage;
		STAGE_ITEM_TYPES.forEach(type => {
			const store = this.items?.[type];
			if (!store) return;
			values(store.items).forEach(item => {
				if (item.stages?.[userId] === fromStage) item.setStage(userId, target);
			});
		});
	}

	/** Сообщить остальным клиентам, что столбцы пользователя изменились */
	broadcast(userId, extra = {}) {
		const ws = this.items?.ws;
		if (ws) ws.sendMessage({ event: 'stageUpdate', userId, ...extra });
	}

	/** WS-событие stageUpdate от другого клиента */
	onRemoteUpdate(data) {
		const userId = Number(data.userId);
		if (!userId) return;
		if (data.removed) this.patchItems(userId, Number(data.removed), Number(data.movedTo) || null);
		// перечитываем только тех, чьи столбцы уже кому-то понадобились
		if (this.requested.has(userId)) this.load(userId);
	}
}

export default StagesStore;
