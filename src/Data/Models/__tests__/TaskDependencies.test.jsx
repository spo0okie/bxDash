import { autorun, observable, runInAction } from 'mobx';
import ItemsMultiStore from 'Data/Stores/Items/ItemsMultiStore';
import TaskItem from '../TaskItem';
import TimeHelper from 'Helpers/TimeHelper';

// Даты фикстур записаны в поясе тестового API.
beforeEach(() => TimeHelper.setStore({ bitrixOffset: '+05:00', bitrixOffsetMin: 300 }));
afterEach(() => TimeHelper.setStore(null));

/** Имитирует очередь связанных объектов: задача может появиться позже исходной выборки. */
function dependencyBoard() {
	const tasks = new Map();
	const pending = new Set();
	const master = {
		requestRelated(requester, uids) {
			uids.forEach(uid => {
				if (tasks.has(uid)) requester.reverseLinksCheck(tasks.get(uid));
				else pending.add(uid);
			});
		},
	};
	const list = { master, getContext: () => ({ time: { today: 0 } }), activityUpdate: jest.fn() };
	/** Загружает задачу и разрешает ожидающие ссылки так же, как ItemsStore. */
	function load(id, fields = {}) {
		const data = { ID: id, '~TITLE': 'Задача', RESPONSIBLE_ID: 7, REAL_STATUS: 2, ...fields };
		let task = tasks.get('task:' + id);
		runInAction(() => {
			if (task) task.loadData(data, true);
			else task = new TaskItem({}, data, list);
			tasks.set(task.uid, task);
			tasks.forEach(requester => requester.reverseLinksCheck(task));
		});
		return task;
	}
	return { load, pending };
}

test.each(['parents', 'children'])('счётчик %s учитывает общие ветки один раз и защищён от циклов', direction => {
	const { load } = dependencyBoard();
	const tasks = [1, 2, 3, 4].map(id => load(id));
	runInAction(() => {
		// Ромб с обратной связью: исходная задача не должна попасть в счётчик.
		tasks[0][direction] = [tasks[1], tasks[2]];
		tasks[1][direction] = [tasks[3]];
		tasks[2][direction] = [tasks[3]];
		tasks[3][direction] = [tasks[0]];
	});
	expect(tasks[0][direction === 'parents' ? 'dependentCount' : 'prerequisiteCount']).toBe(3);
});

test.each([
	['NEXT_TASK_IDS', 'dependentCount'],
	['PREV_TASK_IDS', 'prerequisiteCount'],
])('счётчик реактивно обновляется при дозагрузке, закрытии и удалении связей: %s', (field, counter) => {
	const { load } = dependencyBoard();
	const task = load(1, { [field]: [2] });
	const values = [];
	const dispose = autorun(() => values.push(task[counter]));
	try {
		load(2, { [field]: [3] });
		load(3);
		// Закрываем промежуточную задачу: дальняя всё ещё учитывается.
		load(2, { [field]: [3], REAL_STATUS: 5, CLOSED_DATE: '09.11.2026 12:00:00' });
		load(2, { [field]: [3] });
		load(1);
		expect(values).toEqual([0, 1, 2, 1, 2, 0]);
	} finally {
		dispose();
	}
});

test('обе стороны зависимостей запрашиваются вне выборки и подсвечиваются в нужном направлении', () => {
	const { load, pending } = dependencyBoard();
	const task = load(1, { PARENT_ID: '2', NEXT_TASK_IDS: ['2', '3', '3'], PREV_TASK_IDS: ['4'] });
	expect(task.parentUids).toEqual(['task:2', 'task:3']);
	expect(task.childUids).toEqual(['task:4']);
	expect([...pending]).toEqual(['task:2', 'task:3', 'task:4']);
	const base = load(2);
	const next = load(3, { PREV_TASK_IDS: ['1'] });
	const prev = load(4, { NEXT_TASK_IDS: ['1'] });
	task.setHover(true);
	expect([base.isHoveredParent, next.isHoveredParent, prev.isHoveredChild]).toEqual([true, true, true]);
	task.setHover(false);
	expect([base.isHoveredParent, next.isHoveredParent, prev.isHoveredChild]).toEqual([false, false, false]);
});

test.each([
	[{ NEXT_TASK_IDS: ['2'] }, {}, 'isHoveredParent'],
	[{ PREV_TASK_IDS: ['2'] }, {}, 'isHoveredChild'],
])('достаточно загрузить только одну сторону связи: %j', (fields, otherFields, flag) => {
	const { load } = dependencyBoard();
	const task = load(1, fields);
	const other = load(2, otherFields);
	task.setHover(true);
	expect(other[flag]).toBe(true);
});

test('перезагрузка удаляет старые зависимости', () => {
	const { load } = dependencyBoard();
	const prev = load(4);
	const next = load(3);
	const task = load(1, { NEXT_TASK_IDS: [3], PREV_TASK_IDS: [4] });
	expect(task.childUids).toEqual(['task:4']);
	load(1);
	expect(task.parentUids).toEqual([]);
	expect(task.childUids).toEqual([]);
	expect(prev.parents).not.toContain(task);
	expect(next.children).not.toContain(task);
	task.setHover(true);
	expect(prev.isHoveredChild).toBe(false);
	expect(next.isHoveredParent).toBe(false);
});

test.each([[1, 2], [2, 1]])('счётчик подзадачи сохраняется при порядке ответов %s, %s', (first, second) => {
	const main = { itemsTypes: ['task'] };
	const time = observable({ today: 0, weekMin: 0 });
	const items = new ItemsMultiStore(main, time, { items: new Map() }, { attachItemsStore() {} });
	const row = (id, parentId = 0) => ({
		ID: id, '~TITLE': 'Задача', RESPONSIBLE_ID: 7, REAL_STATUS: 2, PARENT_ID: parentId,
	});
	items.task.initBatch([row(1), row(2), row(3)]);
	const subtask = items.getUidItem('task:1');
	const values = [];
	const dispose = autorun(() => values.push(subtask.dependentCount));
	try {
		// task/get отдаёт PARENT_ID у подзадачи, а у родителя нет списка подзадач.
		for (const id of [first, second]) items.task.initBatch([row(id, id === 1 ? 2 : 0)]);
		expect(values).toEqual([0, 1]);
		const parent = items.getUidItem('task:2');
		expect(subtask.parents).toEqual([parent]);
		expect(parent.children).toEqual([subtask]);
		expect(parent.prerequisiteCount).toBe(1);

		// После переноса старая обратная ссылка должна исчезнуть.
		items.task.initBatch([row(1, 3), row(2), row(3)]);
		expect(subtask.parents).toEqual([items.getUidItem('task:3')]);
		expect(parent.children).toEqual([]);
		expect(parent.prerequisiteCount).toBe(0);
	} finally {
		dispose();
	}
});
