import { Modal } from 'antd';
import { dashItemsDrop, isTaskRelationZone } from '../DndHelper';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { saveTaskRelation } from '../TaskRelations';
import notify from '../Notify';

/** Две задачи с реальным JSON-клиентом и контролируемыми ответами сервера. */
function taskPair(ok = true) {
	const fetch = jest.fn(async () => ({ ok, status: ok ? 200 : 409, text: async () => JSON.stringify(ok ? { result: 'ok' } : { error: 'Недостаточно прав' }) }));
	const source = { id: 1, uid: 'task:1', type: 'task', title: 'Первая', context: { main: { bx: { fetch } } }, reload: jest.fn(), broadcastUpdate: jest.fn(), movePosition: jest.fn() };
	const target = { ...source, id: 2, uid: 'task:2', title: 'Вторая', reload: jest.fn(), broadcastUpdate: jest.fn() };
	return { source, target, fetch };
}

test('дроп на соседнюю задачу открывает выбор связи вместо сортировки', async () => {
	const { source, target, fetch } = taskPair();
	const confirm = jest.spyOn(Modal, 'confirm').mockReturnValue({ destroy() {} });
	const success = jest.spyOn(notify, 'success').mockImplementation(() => {});
	try {
		const cell = { data: { type: 'cell', cell: { id: 'same' }, items: [source, target] } };
		dashItemsDrop(source, { initial: { dropTargets: [cell] }, current: { dropTargets: [{ data: { type: 'item', item: target, index: 1, linkTasks: true } }, cell] } });
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(source.movePosition).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled(); // До подтверждения, включая отмену, записи нет.
		await confirm.mock.calls[0][0].onOk();
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ targetId: 2, relation: 'subtask' });
	} finally { confirm.mockRestore(); success.mockRestore(); }
});

test.each([[100, false], [125, false], [126, true], [150, true], [174, true], [175, false], [200, false]])(
	'позиция курсора %s определяет создание связи: %s', (clientY, expected) => {
		const { source, target } = taskPair();
		expect(isTaskRelationZone(source, target, { top: 100, height: 100 }, clientY)).toBe(expected);
		expect(isTaskRelationZone(source, source, { top: 100, height: 100 }, clientY)).toBe(false);
	});

test.each([['top', 1, 0, 110], ['bottom', 0, 1, 190]])('дроп у края %s переставляет задачи в столбце', (edge, sourceIndex, targetIndex, clientY) => {
	const { source, target } = taskPair();
	Object.assign(source, { sorting: sourceIndex ? 100 : 200, maxSort: 2147483647, stageFor: () => 1 });
	Object.assign(target, { sorting: targetIndex ? 100 : 200 });
	const items = sourceIndex ? [target, source] : [source, target];
	const cell = { data: { type: 'cell', cell: { id: 'same', kanban: true, user: 7, stage: { id: 1 } }, items } };
	const element = document.createElement('div');
	element.getBoundingClientRect = () => ({ top: 100, bottom: 200, height: 100, left: 0, right: 100, width: 100 });
	const data = attachClosestEdge({ type: 'item', item: target, index: targetIndex,
		linkTasks: isTaskRelationZone(source, target, element.getBoundingClientRect(), clientY),
	}, { element, input: { clientY, clientX: 50 }, allowedEdges: ['top', 'bottom'] });
	const confirm = jest.spyOn(Modal, 'confirm').mockReturnValue({});
	const log = jest.spyOn(console, 'log').mockImplementation(() => {});
	try {
		dashItemsDrop(source, { initial: { dropTargets: [cell] }, current: { dropTargets: [{ data }, cell] } });
		expect(source.movePosition).toHaveBeenCalledWith({ sorting: edge === 'top' ? 220 : 80 });
		expect(confirm).not.toHaveBeenCalled();
	} finally { confirm.mockRestore(); log.mockRestore(); }
});

test.each(['subtask', 'next', 'previous'])('сохранение %s перечитывает и рассылает обновление обеих задач', async relation => {
	const { source, target, fetch } = taskPair();
	await saveTaskRelation(source, target, relation);
	expect(fetch).toHaveBeenCalledWith('task/link/1', expect.objectContaining({ method: 'POST', body: JSON.stringify({ targetId: 2, relation }) }));
	[source, target].forEach(task => {
		expect(task.reload).toHaveBeenCalledTimes(1);
		expect(task.broadcastUpdate).toHaveBeenCalledTimes(1);
	});
});

test('отказ сервера показывается пользователю и не закрывает диалог', async () => {
	const { source, target } = taskPair(false);
	const confirm = jest.spyOn(Modal, 'confirm').mockReturnValue({});
	const error = jest.spyOn(notify, 'error').mockImplementation(() => {});
	try {
		const { chooseTaskRelation } = await import('../TaskRelations');
		chooseTaskRelation(source, target);
		await expect(confirm.mock.calls[0][0].onOk()).rejects.toThrow('Недостаточно прав');
		expect(error).toHaveBeenCalledWith('Недостаточно прав', expect.any(Object));
		expect(source.reload).not.toHaveBeenCalled();
		expect(target.broadcastUpdate).not.toHaveBeenCalled();
	} finally { confirm.mockRestore(); error.mockRestore(); }
});
