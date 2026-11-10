import { autorun, observable, runInAction } from 'mobx';
import PlanItem from '../PlanItem';
import TaskItem from '../TaskItem';
import ItemsMultiStore from 'Data/Stores/Items/ItemsMultiStore';

/** Создаёт план и хранилище с настоящим поиском по UID без сетевых запросов. */
function planBoard(title = 'Задача 13709') {
	const master = {
		task: { items: observable.map() },
		getUidItem: ItemsMultiStore.prototype.getUidItem,
		getUidsItems: ItemsMultiStore.prototype.getUidsItems,
		requestRelated(requester, uids) {
			this.getUidsItems(uids).forEach(item => requester.reverseLinksCheck(item));
		},
	};
	const list = { master, getContext: () => ({ time: { today: 0 } }) };
	const plan = new PlanItem({}, { ID: 1, '~PREVIEW_TEXT': title }, list);
	/** Имитирует загрузку и повторное чтение задачи из Bitrix. */
	function loadTask(title) {
		runInAction(() => {
			const data = { ID: 13709, '~TITLE': title, REAL_STATUS: 2 };
			const existing = master.task.items.get(13709);
			if (existing) existing.loadData(data, true);
			else {
				const task = new TaskItem({}, data, list);
				master.task.items.set(task.id, task);
				plan.reverseLinksCheck(task);
			}
		});
	}
	return { plan, loadTask };
}

test('заголовок плана появляется при дозагрузке и сохраняется после обновления задачи', () => {
	const { plan, loadTask } = planBoard();
	const titles = [];
	const dispose = autorun(() => titles.push(plan.cleanTitle()));
	try {
		loadTask('Настроить сервер');
		loadTask('Проверить сервер');
		// Перестроение связей задачи не должно удалять текст рядом с плашкой плана.
		expect(plan.childUids).toEqual(['task:13709']);
		expect(titles).toEqual(['', 'Настроить сервер', 'Проверить сервер']);
	} finally {
		dispose();
	}
});

test('собственный текст плана сохраняется и реактивно обновляется', () => {
	const { plan, loadTask } = planBoard('Задача 13709: проверить доступ');
	loadTask('Настроить сервер');
	const titles = [];
	const dispose = autorun(() => titles.push(plan.cleanTitle()));
	try {
		runInAction(() => {
			plan.title = 'Задача 13709: проверить журналы';
			plan.parseTitle();
		});
		expect(titles).toEqual([': проверить доступ', ': проверить журналы']);
	} finally {
		dispose();
	}
});
