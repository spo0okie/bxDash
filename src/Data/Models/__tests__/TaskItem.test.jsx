import { autorun, runInAction } from 'mobx';
import TaskItem from '../TaskItem';
import ItemsMultiStore from 'Data/Stores/Items/ItemsMultiStore';
import notify from 'Helpers/Notify';

/** Задача и меню с отдельными пользователями: вошедший — 5, владелец ячейки — 7. */
function watchingTask(fields = {}, fetch = jest.fn()) {
	const main = { itemsTypes: [], bx: { userId: 5, fetch } };
	const list = { getContext: () => ({ main, time: { today: 0 } }), broadcastUpdate: jest.fn(), activityUpdate: jest.fn(), updateItem: jest.fn(), loadItem: jest.fn() };
	const task = new TaskItem({}, { ID: '1', RESPONSIBLE_ID: '7', CREATED_BY: '8', AUDITORS: [], REAL_STATUS: '2', ...fields }, list);
	const items = new ItemsMultiStore(main, {}, {}, { attachItemsStore() {} });
	return { task, items, list };
}

test.each([
	[{}, 'Стать наблюдателем'],
	[{ AUDITORS: ['5', '9'] }, 'Прекратить наблюдать'],
	[{ RESPONSIBLE_ID: '5' }, undefined],
	[{ CREATED_BY: '5' }, undefined],
])('меню наблюдения зависит от роли вошедшего пользователя: %j', (data, label) => {
	const { task, items } = watchingTask(data);
	expect(items.contextMenu(task, { user: 7 }).find(entry => entry.key === 'watch')?.label).toBe(label);
});

test('наблюдение из поиска отправляет только нужное состояние и обновляет роли после ответа', async () => {
	const fetch = jest.fn(async () => ({ ok: true, text: async () => JSON.stringify({ id: 1 }) }));
	const { task, items, list } = watchingTask({}, fetch);
	// Имитируем общий reload после update: наблюдатели приходят из обычного task/get.
	list.loadItem.mockImplementation(() => runInAction(() => { task.auditors = [5, 9]; task.setUpdating(false); }));
	const success = jest.spyOn(notify, 'success').mockImplementation(() => {});
	try {
		items.contextMenuHandler(task, null)({ key: 'watch' });
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(fetch).toHaveBeenCalledWith('task/update/1', expect.objectContaining({ method: 'POST', body: '{"watching":true,"id":1}' }));
		expect(list.updateItem).toHaveBeenCalledWith({ id: 1 });
		expect(list.loadItem).toHaveBeenCalledWith(1);
		expect(task.auditors).toEqual([5, 9]);
		expect(task.isWatching).toBe(true);
		expect(task.isUpdating).toBe(false);
		expect(list.broadcastUpdate).toHaveBeenCalledWith(1);
		expect(items.contextMenu(task, null).find(entry => entry.key === 'watch').label).toBe('Прекратить наблюдать');
	} finally { success.mockRestore(); }
});

test('ошибка сервера сохраняет наблюдателей и показывает причину', async () => {
	const fetch = jest.fn(async () => ({ ok: false, status: 409, text: async () => '{"error":"Недостаточно прав"}' }));
	const { task, items, list } = watchingTask({ AUDITORS: ['5', '9'] }, fetch);
	const error = jest.spyOn(notify, 'error').mockImplementation(() => {});
	const log = jest.spyOn(console, 'log').mockImplementation(() => {});
	try {
		items.contextMenuHandler(task, null)({ key: 'watch' });
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(task.auditors).toEqual([5, 9]);
		expect(task.isUpdating).toBe(false);
		expect(error).toHaveBeenCalledWith('Недостаточно прав', expect.any(Object));
		expect(list.broadcastUpdate).not.toHaveBeenCalled();
		expect(list.loadItem).toHaveBeenCalledWith(1); //общий путь перечитывает состояние после ошибки
	} finally { error.mockRestore(); log.mockRestore(); }
});

test('ответственный не может вызвать наблюдение в обход меню', async () => {
	const fetch = jest.fn();
	const { task, items } = watchingTask({ RESPONSIBLE_ID: '5' }, fetch);
	items.contextMenuHandler(task, null)({ key: 'watch' });
	expect(fetch).not.toHaveBeenCalled();
});

test('роли API приводятся к числам и обновляются реактивно после перезагрузки задачи', () => {
	const data = { ID: '1', RESPONSIBLE_ID: '7', CREATED_BY: '5', AUDITORS: ['5'], ACCOMPLICES: ['9'], REAL_STATUS: '2' };
	const task = new TaskItem({}, data, { getContext: () => ({ time: { today: 0 } }) });
	const seen = [];
	const dispose = autorun(() => seen.push([task.creatorId, task.auditors.slice(), task.accomplices.slice()]));
	try {
		expect(seen).toEqual([[5, [5], [9]]]);
		runInAction(() => task.loadData({ ...data, CREATED_BY: '9', AUDITORS: ['8'], ACCOMPLICES: ['5'] }, true));
		expect(seen.at(-1)).toEqual([9, [8], [5]]);
		runInAction(() => task.loadData({ ID: '1', RESPONSIBLE_ID: '7', REAL_STATUS: '2' }, true));
		expect(seen.at(-1)).toEqual([null, [], []]);
	} finally {
		dispose();
	}
});
