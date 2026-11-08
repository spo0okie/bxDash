import { runInAction } from 'mobx';
import TaskItem from '../TaskItem';

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
