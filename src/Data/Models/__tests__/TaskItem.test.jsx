import { autorun, runInAction } from 'mobx';
import TaskItem from '../TaskItem';

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
