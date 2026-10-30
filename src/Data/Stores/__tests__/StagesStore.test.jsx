import { observable, autorun, runInAction } from 'mobx';
import StagesStore, { stageFromRow } from 'Data/Stores/StagesStore';
import DashItem from 'Data/Models/DashItem';
import LayoutStore from 'Data/Stores/LayoutStore';
import notify from 'Helpers/Notify';

const OWNER = 5;
const OTHER = 7;

const row = (id, title, sort, isDefault = false, userId = OWNER, color = null, stacked = false) => ({
	ID: id, USER_ID: userId, TITLE: title, SORT: sort, COLOR: color, IS_DEFAULT: isDefault ? 'Y' : 'N', STACKED: stacked ? 'Y' : 'N',
});

const OWNER_ROWS = [row(1, 'Входящие', 100, true), row(2, 'Ожидание', 200), row(3, 'На проверке', 300)];

/** Дождаться всех уже запущенных запросов (макротаск — после любой цепочки промисов) */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/** Собирает стор с поддельным бэкендом. routes: endpoint-префикс → (body) => ответ | {status, body} */
function setup(routes = {}) {
	const calls = [];
	const bx = {
		authStatus: 'OK',
		fetch: jest.fn(async (endpoint, options = {}) => {
			const body = options.body ? JSON.parse(options.body) : null;
			calls.push({ endpoint, body });
			const key = Object.keys(routes).find(prefix => endpoint.startsWith(prefix));
			let answer = key ? routes[key](body, endpoint) : { status: 404, body: { result: 'error', error: 'нет маршрута ' + endpoint } };
			if (answer.status === undefined) answer = { status: 200, body: answer };
			return { ok: answer.status < 400, status: answer.status, text: async () => JSON.stringify(answer.body) };
		}),
	};
	const main = { bx };
	const users = observable({ selected: OWNER });
	// шпион снаружи observable: mobx оборачивает функции-поля в action, и jest перестаёт видеть в них mock
	const resetHeights = jest.fn();
	const layout = observable({ accomplicesVisible: false, resetKanbanHeights: ids => resetHeights(ids) });
	const time = { today: 1000, year: 2026, firstWeekStart: () => 500 };
	const ws = { sendMessage: jest.fn() };
	const items = { ws };
	['task', 'job', 'ticket', 'plan'].forEach(type => { items[type] = { items: observable.map() }; });

	const stages = new StagesStore(main, users, items, layout, time);

	/** Настоящий DashItem на поддельном списке */
	const add = (type, id, fields = {}, data = {}) => {
		const list = {
			getContext: () => ({ time, main, get stages() { return items.stages; } }),
			updateItem: jest.fn(),
			activityUpdate: jest.fn(),
		};
		const item = new DashItem({ id, user: OWNER, sorting: 100, ...fields }, data, list);
		item.type = type;
		items[type].items.set(id, item);
		return item;
	};

	return { stages, bx, calls, users, layout, items, ws, add, resetHeights };
}

beforeEach(() => {
	jest.spyOn(notify, 'error').mockImplementation(() => null);
	jest.spyOn(notify, 'success').mockImplementation(() => null);
	jest.spyOn(console, 'error').mockImplementation(() => {});
	jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('StagesStore: загрузка', () => {
	test('stageFromRow приводит строку бэка к объекту стадии', () => {
		expect(stageFromRow(row(4, 'Дальние', 400, false, OWNER, '#ffaa00'))).toEqual({
			id: 4, userId: OWNER, title: 'Дальние', sort: 400, color: '#ffaa00', isDefault: false, stacked: false,
		});
		expect(stageFromRow({ ID: '1', USER_ID: '5', TITLE: 'Входящие', SORT: '100', COLOR: null, IS_DEFAULT: 'Y' }).isDefault).toBe(true);
	});

	test('первое обращение запускает загрузку один раз и перерисовывает наблюдателей', async () => {
		const { stages, calls } = setup({ 'stage/list/5': () => OWNER_ROWS });
		const seen = [];
		const dispose = autorun(() => seen.push(stages.stagesOf(OWNER).map(s => s.title)));

		expect(seen).toEqual([[]]);
		expect(stages.isLoaded(OWNER)).toBe(false);
		stages.stagesOf(OWNER);
		stages.stagesOf(OWNER);
		await flush();

		expect(calls.filter(c => c.endpoint.startsWith('stage/list/5'))).toHaveLength(1);
		expect(seen[seen.length - 1]).toEqual(['Входящие', 'Ожидание', 'На проверке']);
		expect(stages.isLoaded(OWNER)).toBe(true);
		dispose();
	});

	test('столбцы сортируются по sort, столбец по умолчанию находится', async () => {
		const { stages } = setup({ 'stage/list/5': () => [row(3, 'В', 300), row(1, 'А', 100, true), row(2, 'Б', 200)] });
		await stages.load(OWNER);
		expect(stages.stagesOf(OWNER).map(s => s.id)).toEqual([1, 2, 3]);
		expect(stages.defaultStageOf(OWNER).id).toBe(1);
		expect(stages.hasStage(OWNER, 2)).toBe(true);
		expect(stages.hasStage(OWNER, 99)).toBe(false);
		expect(stages.stageById(3).title).toBe('В');
		expect(stages.stageById(99)).toBeNull();
	});

	test('ошибка загрузки показывается уведомлением и не повторяется на каждый рендер', async () => {
		const { stages, calls } = setup({ 'stage/list/5': () => ({ status: 500, body: { result: 'error', error: 'Ошибка БД' } }) });
		stages.stagesOf(OWNER);
		await flush();
		stages.stagesOf(OWNER);
		await flush();

		expect(calls).toHaveLength(1);
		expect(notify.error).toHaveBeenCalledTimes(1);
		expect(notify.error.mock.calls[0][0]).toBe('Ошибка БД');
		expect(stages.stagesOf(OWNER)).toEqual([]);
		expect(stages.defaultStageOf(OWNER)).toBeNull();
	});

	test('без пользователя ничего не запрашивается', async () => {
		const { stages, calls } = setup();
		expect(stages.stagesOf(null)).toEqual([]);
		expect(stages.stagesOf(0)).toEqual([]);
		await flush();
		expect(calls).toHaveLength(0);
	});
});

describe('DashItem: привязки к столбцам', () => {
	test('STAGES из данных бэка читается в числовую карту', async () => {
		const { add } = setup();
		const item = add('task', 10, {}, { ID: 10, STAGES: { '5': 2, '7': '9' } });
		expect(item.stages).toEqual({ 5: 2, 7: 9 });
		item.loadData({ ID: 10, STAGES: {} });
		expect(item.stages).toEqual({});
		// PHP отдаёт пустой объект, но и пустой массив не должен ломать
		item.loadData({ ID: 10, STAGES: [] });
		expect(item.stages).toEqual({});
	});

	test('stageFor: явная привязка / нет привязки / неизвестный столбец', async () => {
		const { stages, add } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		expect(add('task', 1, {}, { ID: 1, STAGES: { 5: 2 } }).stageFor(OWNER)).toBe(2);
		expect(add('task', 2, {}, { ID: 2, STAGES: {} }).stageFor(OWNER)).toBe(1);
		// столбец удалён или чужой — элемент в столбце по умолчанию
		expect(add('task', 3, {}, { ID: 3, STAGES: { 5: 99 } }).stageFor(OWNER)).toBe(1);
		// привязка другого пользователя на чужую доску не влияет
		expect(add('task', 4, {}, { ID: 4, STAGES: { 7: 2 } }).stageFor(OWNER)).toBe(1);
	});

	test('stageFor возвращает null, пока столбцы не загружены', () => {
		const { add } = setup({ 'stage/list/5': () => OWNER_ROWS });
		expect(add('task', 1, {}, { ID: 1, STAGES: { 5: 2 } }).stageFor(OWNER)).toBeNull();
	});

	test('update({stage, stageUser}) меняет привязку, а не поля элемента', () => {
		const { add } = setup();
		const item = add('task', 1);
		const params = { stage: 3, stageUser: OWNER, sorting: 700 };
		item.update(params);

		expect(item.stages).toEqual({ 5: 3 });
		expect(item.list.updateItem).toHaveBeenCalledWith({ id: 1, sorting: 700 });
		// в бэк параметры должны уйти как есть
		expect(params).toMatchObject({ stage: 3, stageUser: OWNER });

		item.update({ stage: null, stageUser: OWNER });
		expect(item.stages).toEqual({});
	});

	test('save передаёт stage и stageUser в бэк', async () => {
		const { add, calls } = setup({ 'dash/update/1': () => ({ result: 'ok', id: 1 }) });
		const item = add('task', 1, {}, { ID: 1 });
		item.type = 'dash';
		item.list.loadItem = jest.fn();
		item.list.broadcastUpdate = jest.fn();
		item.update({ stage: 3, stageUser: OWNER }, true);
		await flush();

		expect(calls[0].endpoint).toBe('dash/update/1');
		expect(calls[0].body).toEqual({ stage: 3, stageUser: OWNER, id: 1 });
	});
});

describe('StagesStore: доска', () => {
	test('ролевые колонки исключают ответственного и переключают соисполнителя вместе с «помогаю»', async () => {
		const { stages, add, layout } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		const control = add('task', 20, { user: OTHER, auditors: [OWNER], sorting: 200 });
		const created = add('task', 21, { user: OTHER, creatorId: OWNER });
		const both = add('task', 22, { user: OTHER, creatorId: OWNER, auditors: [OWNER], accomplices: [OWNER], sorting: 300 });
		add('task', 23, { auditors: [OWNER], creatorId: OWNER }); // ответственный — только обычный столбец
		add('task', 24, { user: OTHER, auditors: [OWNER], creatorId: OWNER, closedDate: 800 });
		add('job', 25, { user: OTHER, auditors: [OWNER], creatorId: OWNER }); // роли только у задач

		expect(stages.board.control).toEqual([both, control]);
		expect(stages.board.created).toEqual([both, created]);
		expect(stages.board.byStage.get(1)).not.toContain(both);
		runInAction(() => { layout.accomplicesVisible = true; });
		expect(stages.board.control).toEqual([control]);
		expect(stages.board.created).toEqual([created]);
		expect(stages.board.byStage.get(1)).toContain(both);
		expect(stages.board.closed).toEqual([]);
	});

	test('раскладывает открытые элементы владельца по столбцам одним проходом', async () => {
		const { stages, add } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);

		const inbox = add('task', 1, { sorting: 100 });
		const waiting = add('task', 2, { sorting: 100 }, { ID: 2, STAGES: { 5: 2 } });
		const waitingTop = add('job', 3, { sorting: 900 }, { ID: 3, STAGES: { 5: 2 } });
		const orphan = add('task', 4, { sorting: 50 }, { ID: 4, STAGES: { 5: 99 } });
		add('task', 5, { user: OTHER }, { ID: 5, STAGES: { 5: 2 } });	// чужая задача
		add('plan', 6);													// планы на доску не идут

		const { byStage, closed } = stages.board;
		expect([...byStage.keys()]).toEqual([1, 2, 3]);
		expect(byStage.get(1)).toEqual([inbox, orphan]);
		expect(byStage.get(2)).toEqual([waitingTop, waiting]);	// по убыванию sorting
		expect(byStage.get(3)).toEqual([]);
		expect(closed).toEqual([]);
	});

	test('закрытые идут отдельным списком и только в пределах загруженной истории', async () => {
		const { stages, add } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		const recent = add('task', 1, { closedDate: 800 }, { ID: 1, STAGES: { 5: 2 } });
		add('task', 2, { closedDate: 100 });	// раньше firstWeekStart

		const { byStage, closed } = stages.board;
		expect(closed).toEqual([recent]);
		expect(byStage.get(2)).toEqual([]);
		// привязка при закрытии не теряется
		expect(recent.stages).toEqual({ 5: 2 });
	});

	test('задачи соисполнителя попадают на доску только при accomplicesVisible', async () => {
		const { stages, add, layout } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		const helping = add('task', 1, { user: OTHER, accomplices: [OWNER] });

		expect(stages.board.byStage.get(1)).toEqual([]);
		runInAction(() => { layout.accomplicesVisible = true; });
		expect(stages.board.byStage.get(1)).toEqual([helping]);
	});

	test('без выбранного пользователя доска пуста, смена привязки перестраивает доску', async () => {
		const { stages, add, users } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		const item = add('task', 1);

		const seen = [];
		const dispose = autorun(() => seen.push(stages.board.byStage.get(2)?.length ?? null));
		item.setStage(OWNER, 2);
		runInAction(() => { users.selected = null; });

		expect(seen).toEqual([0, 1, null]);
		expect(stages.owner).toBeNull();
		dispose();
	});

	test('пока столбцы не загружены, доска пустая', () => {
		const { stages, add } = setup({ 'stage/list/5': () => OWNER_ROWS });
		add('task', 1);
		expect(stages.board.byStage.size).toBe(0);
	});
});

describe('StagesStore: изменение', () => {
	test('create добавляет столбец, рассылает WS и сообщает об успехе', async () => {
		const { stages, calls, ws } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/create': body => ({ result: 'ok', id: 4, stage: row(4, body.title, 400, false, OWNER, body.color) }),
		});
		await stages.load(OWNER);
		const created = await stages.create(OWNER, 'Дальние', '#ffaa00');

		expect(created).toMatchObject({ id: 4, title: 'Дальние', color: '#ffaa00' });
		expect(calls[1]).toEqual({ endpoint: 'stage/create', body: { user: OWNER, title: 'Дальние', color: '#ffaa00' } });
		expect(stages.stagesOf(OWNER).map(s => s.id)).toEqual([1, 2, 3, 4]);
		expect(ws.sendMessage).toHaveBeenCalledWith({ event: 'stageUpdate', userId: OWNER });
		expect(notify.success).toHaveBeenCalled();
	});

	test('create: отказ бэка — уведомление и null', async () => {
		const { stages } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/create': () => ({ status: 409, body: { result: 'error', error: 'Название столбца не может быть пустым' } }),
		});
		await stages.load(OWNER);
		expect(await stages.create(OWNER, '')).toBeNull();
		expect(notify.error.mock.calls[0][0]).toBe('Название столбца не может быть пустым');
		expect(stages.stagesOf(OWNER)).toHaveLength(3);
	});

	test('update меняет столбец сразу, а при ошибке откатывается к бэку', async () => {
		let fail = false;
		const { stages } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/update/2': body => (fail
				? { status: 409, body: { result: 'error', error: 'нельзя' } }
				: { result: 'ok', id: 2, stage: row(2, body.title, 200) }),
		});
		await stages.load(OWNER);

		const ok = stages.update(2, { title: 'Ждём' });
		expect(stages.stageById(2).title).toBe('Ждём');	// оптимистично, до ответа
		expect(await ok).toBe(true);

		fail = true;
		const bad = stages.update(2, { title: 'Сломать' });
		expect(stages.stageById(2).title).toBe('Сломать');
		expect(await bad).toBe(false);
		await flush();
		expect(stages.stageById(2).title).toBe('Ожидание');	// перечитано с бэка
		expect(notify.error).toHaveBeenCalledTimes(1);
	});

	test('remove переносит элементы локально: в указанный столбец или в столбец по умолчанию', async () => {
		const { stages, add, ws } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/delete/2': body => ({ result: 'ok', id: 2, movedTo: body.moveTo ?? 1 }),
			'stage/delete/3': () => ({ result: 'ok', id: 3, movedTo: 1 }),
		});
		await stages.load(OWNER);
		const a = add('task', 1, {}, { ID: 1, STAGES: { 5: 2, 7: 2 } });
		const b = add('job', 2, {}, { ID: 2, STAGES: { 5: 2 } });

		expect(await stages.remove(2, 3)).toBe(true);
		expect(a.stages).toEqual({ 5: 3, 7: 2 });	// чужая привязка не тронута
		expect(b.stages).toEqual({ 5: 3 });
		expect(stages.stagesOf(OWNER).map(s => s.id)).toEqual([1, 3]);
		expect(ws.sendMessage).toHaveBeenLastCalledWith({ event: 'stageUpdate', userId: OWNER, removed: 2, movedTo: 3 });

		expect(await stages.remove(3)).toBe(true);
		expect(a.stages).toEqual({ 7: 2 });		// в столбец по умолчанию = привязки нет
		expect(a.stageFor(OWNER)).toBe(1);
	});

	test('remove: отказ бэка ничего не меняет локально', async () => {
		const { stages } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/delete/1': () => ({ status: 409, body: { result: 'error', error: 'Столбец по умолчанию удалить нельзя' } }),
		});
		await stages.load(OWNER);
		expect(await stages.remove(1)).toBe(false);
		expect(stages.stagesOf(OWNER)).toHaveLength(3);
		expect(notify.error.mock.calls[0][0]).toBe('Столбец по умолчанию удалить нельзя');
	});

	test('reorder переставляет сразу и принимает порядок бэка', async () => {
		const { stages, calls } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/reorder': () => ({ result: 'ok', stages: [row(3, 'На проверке', 100), row(2, 'Ожидание', 200), row(1, 'Входящие', 300, true)] }),
		});
		await stages.load(OWNER);
		const done = stages.reorder(OWNER, [3, 2]);
		expect(stages.stagesOf(OWNER).map(s => s.id)).toEqual([3, 2, 1]);
		expect(await done).toBe(true);
		expect(calls[1].body).toEqual({ user: OWNER, ids: [3, 2] });
		expect(stages.stagesOf(OWNER).map(s => s.id)).toEqual([3, 2, 1]);
	});

	test('dropStage: под столбец — в его стопку, сбоку — отдельной стопкой', async () => {
		// подставной бэк повторяет логику настоящего: порядок из ids, признак из stacked
		const { stages, calls, resetHeights } = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/reorder': body => ({
				result: 'ok',
				stages: body.ids.map((id, i) => row(id, 'С' + id, (i + 1) * 100, id === 1, OWNER, null, (body.stacked ?? []).includes(id))),
			}),
		});
		await stages.load(OWNER);
		const shape = () => stages.stacksOf(OWNER).map(stack => stack.map(s => s.id));
		expect(shape()).toEqual([[1], [2], [3]]);

		// столбец 3 — под столбец 1
		const done = stages.dropStage(3, 1, 'bottom');
		expect(shape()).toEqual([[1, 3], [2]]);		// оптимистично, до ответа
		expect(await done).toBe(true);
		expect(calls[1]).toEqual({ endpoint: 'stage/reorder', body: { user: OWNER, ids: [1, 3, 2], stacked: [3] } });
		expect(shape()).toEqual([[1, 3], [2]]);

		// веса высот затронутых стопок сброшены: и той, куда пришёл столбец, и его прежней
		expect(resetHeights).toHaveBeenLastCalledWith([3, 1, 3]);

		// столбец 2 — над столбцом 1, в ту же стопку
		expect(await stages.dropStage(2, 1, 'top')).toBe(true);
		expect(shape()).toEqual([[2, 1, 3]]);
		expect(calls[2].body).toEqual({ user: OWNER, ids: [2, 1, 3], stacked: [1, 3] });

		// столбец 1 — отдельной стопкой слева
		expect(await stages.dropStage(1, 2, 'left')).toBe(true);
		expect(shape()).toEqual([[1], [2, 3]]);
		expect(calls[3].body).toEqual({ user: OWNER, ids: [1, 2, 3], stacked: [3] });
	});

	test('dropStage: перенос «на то же место» и на себя запрос не отправляет', async () => {
		const { stages, calls } = setup({ 'stage/list/5': () => OWNER_ROWS });
		await stages.load(OWNER);
		expect(await stages.dropStage(2, 1, 'right')).toBe(false);	// уже стоит справа от 1
		expect(await stages.dropStage(2, 3, 'left')).toBe(false);	// уже стоит слева от 3
		expect(await stages.dropStage(2, 2, 'top')).toBe(false);
		expect(await stages.dropStage(2, 99, 'top')).toBe(false);
		expect(calls).toHaveLength(1);
	});

	test('бэкенд без поддержки стопок: стопка не сохраняется, и об этом сказано явно', async () => {
		const old = (id, title, sort, isDefault = false) => ({ ID: id, USER_ID: OWNER, TITLE: title, SORT: sort, COLOR: null, IS_DEFAULT: isDefault ? 'Y' : 'N' });
		const { stages } = setup({
			'stage/list/5': () => [old(1, 'Входящие', 100, true), old(2, 'А', 200), old(3, 'Б', 300)],
			'stage/reorder': () => ({ result: 'ok', stages: [old(1, 'Входящие', 100, true), old(3, 'Б', 200), old(2, 'А', 300)] }),
		});
		await stages.load(OWNER);
		await stages.dropStage(3, 1, 'bottom');

		expect(stages.stacksOf(OWNER).map(stack => stack.map(s => s.id))).toEqual([[1], [3], [2]]);
		expect(notify.error).toHaveBeenCalledTimes(1);
		expect(notify.error.mock.calls[0][1]).toEqual({ title: 'Стопка не сохранена' });
	});

	test('reorder без stacked раскладку по стопкам не трогает', async () => {
		const rows = [row(1, 'Входящие', 100, true), row(2, 'Ожидание', 200, false, OWNER, null, true), row(3, 'На проверке', 300)];
		const { stages, calls } = setup({
			'stage/list/5': () => rows,
			'stage/reorder': () => ({ result: 'ok', stages: [row(3, 'На проверке', 100), row(1, 'Входящие', 200, true), row(2, 'Ожидание', 300, false, OWNER, null, true)] }),
		});
		await stages.load(OWNER);
		const done = stages.reorder(OWNER, [3, 1, 2]);
		expect(stages.stacksOf(OWNER).map(stack => stack.map(s => s.id))).toEqual([[3], [1, 2]]);
		await done;
		expect(calls[1].body).toEqual({ user: OWNER, ids: [3, 1, 2] });
	});

	test('remove верхнего столбца стопки: нижний встаёт на его место', async () => {
		const rows = [row(1, 'Входящие', 100, true), row(2, 'А', 200), row(3, 'Б', 300, false, OWNER, null, true)];
		const { stages } = setup({
			'stage/list/5': () => rows,
			'stage/delete/2': () => ({ result: 'ok', id: 2, movedTo: 1 }),
		});
		await stages.load(OWNER);
		expect(stages.stacksOf(OWNER).map(stack => stack.map(s => s.id))).toEqual([[1], [2, 3]]);
		await stages.remove(2);
		// без поправки столбец 3 «прилип» бы к стопке столбца 1
		expect(stages.stacksOf(OWNER).map(stack => stack.map(s => s.id))).toEqual([[1], [3]]);
	});
});

describe('StagesStore: смешанные стопки', () => {
	/** Настоящие локальные настройки поверх тестового серверного API стадий. */
	async function mixed(fail = false) {
		const context = setup({
			'stage/list/5': () => OWNER_ROWS,
			'stage/reorder': body => fail
				? { status: 409, body: { error: 'нельзя' } }
				: { stages: body.ids.map((id, index) => row(id, 'С' + id, (index + 1) * 100, id === 1, OWNER, null, body.stacked.includes(id))) },
		});
		const saved = new Map();
		const main = { loadOption: key => saved.get(key), saveOption: (key, value) => saved.set(key, value) };
		const layout = new LayoutStore(main, {}, context.users);
		context.stages.layout = layout;
		await context.stages.load(OWNER);
		return { ...context, layout, main };
	}
	const shape = stages => stages.columnStacksOf(OWNER).map(stack => stack.map(column => column.id));

	test('системную колонку можно поставить слева и в общую стопку, без запроса к серверу', async () => {
		const { stages, layout, calls, main } = await mixed();
		expect(await stages.dropColumn(OWNER, 'closed', 1, 'left')).toBe(true);
		expect(shape(stages)).toEqual([['closed'], [1], [2], [3]]);
		expect(await stages.dropColumn(OWNER, 'closed', 2, 'bottom')).toBe(true);
		expect(shape(stages)).toEqual([[1], [2, 'closed'], [3]]);
		expect(calls).toHaveLength(1);
		layout.setKanbanSystemColumn(OWNER, 'control', true);
		await stages.dropColumn(OWNER, 'control', 3, 'right');
		await stages.dropColumn(OWNER, 'closed', 'control', 'right');
		expect(shape(stages)).toEqual([[1], [2], [3], ['control'], ['closed']]);
		await stages.dropColumn(OWNER, 'closed', 2, 'bottom');
		layout.setKanbanSystemColor(OWNER, 'closed', '#e53935');
		stages.layout = new LayoutStore(main, {}, {});
		expect(shape(stages)).toEqual([[1], [2, 'closed'], [3], ['control']]);
		expect(stages.layout.systemColumnsOf(OWNER)[0].color).toBe('#e53935');
		expect(stages.layout.systemColumnsOf(OTHER)[0].color).toBeNull();
	});

	test('обычные колонки сохраняются на сервере без строковых id, новая колонка не теряется', async () => {
		const { stages, calls, layout } = await mixed();
		await stages.dropColumn(OWNER, 'closed', 2, 'bottom');
		await stages.dropColumn(OWNER, 3, 'closed', 'bottom');
		expect(shape(stages)).toEqual([[1], [2, 'closed', 3]]);
		expect(calls.at(-1)).toEqual({ endpoint: 'stage/reorder', body: { user: OWNER, ids: [1, 2, 3], stacked: [3] } });
		layout.setKanbanSystemColumn(OWNER, 'closed', false);
		expect(shape(stages)).toEqual([[1], [2, 3]]);
		stages.setStages(OWNER, [...stages.stagesOf(OWNER), { id: 4, userId: OWNER, sort: 400 }]);
		layout.setKanbanSystemColumn(OWNER, 'control', true);
		expect(shape(stages)).toEqual([[1], [2, 3], [4], ['control']]);
	});

	test('ошибка серверного сохранения откатывает общую раскладку', async () => {
		const { stages, layout } = await mixed(true);
		expect(await stages.dropColumn(OWNER, 3, 1, 'left')).toBe(false);
		expect(layout.kanbanColumnStacks[OWNER]).toBeNull();
		expect(await stages.dropColumn(OWNER, 'closed', 'closed', 'top')).toBe(false);
	});

	test('обновление обычных стадий с сервера не перекрывается локальным порядком', async () => {
		const { stages } = await mixed();
		await stages.dropColumn(OWNER, 'closed', 2, 'bottom');
		stages.setStages(OWNER, [
			{ id: 3, userId: OWNER, sort: 100 },
			{ id: 2, userId: OWNER, sort: 200 },
			{ id: 1, userId: OWNER, sort: 300 },
		]);
		expect(shape(stages)).toEqual([[3], [2, 'closed'], [1]]);
	});
});

describe('StagesStore: WS', () => {
	test('чужое изменение перечитывает только уже нужные столбцы и переносит элементы', async () => {
		const { stages, calls, add } = setup({ 'stage/list/5': () => OWNER_ROWS, 'stage/list/7': () => [] });
		await stages.load(OWNER);
		const item = add('task', 1, {}, { ID: 1, STAGES: { 5: 2 } });

		stages.onRemoteUpdate({ event: 'stageUpdate', userId: OTHER });
		await flush();
		expect(calls).toHaveLength(1);	// столбцы пользователя 7 никому не нужны — не грузим

		stages.onRemoteUpdate({ event: 'stageUpdate', userId: OWNER, removed: 2, movedTo: 3 });
		expect(item.stages).toEqual({ 5: 3 });
		await flush();
		expect(calls.filter(c => c.endpoint.startsWith('stage/list/5'))).toHaveLength(2);
	});
});
