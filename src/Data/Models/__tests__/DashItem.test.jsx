import DashItem from '../DashItem';
import { dashItemsDrop } from 'Helpers/DndHelper';

/** Карточка соисполнителя без загрузки внешних данных и запуска реакций стора. */
function helpingTask(overrides = {}) {
	return Object.assign(Object.create(DashItem.prototype), {
		uid: 'task/1', user: 7, accomplices: [5], sorting: 500,
		isClosed: false, isUpdating: false, isNew: false, isEdit: false,
		stageFor: jest.fn(() => 1), update: jest.fn(),
		...overrides,
	});
}

test('соисполнитель может перетаскивать карточку только в канбане', () => {
	const task = helpingTask();
	expect(task.isDraggable({ user: 5, kanban: true })).toBe(true);
	expect(task.isDraggable({ user: 5 })).toBe(false);
	expect(task.isDraggable({ user: 7 })).toBe(true);
});

test.each(['isClosed', 'isUpdating', 'isNew', 'isEdit'])('%s запрещает перенос и в канбане', field => {
	expect(helpingTask({ [field]: true }).isDraggable({ user: 5, kanban: true })).toBe(false);
});

test('перенос задачи «помогаю» сохраняет столбец доски соисполнителя без смены даты и ответственного', () => {
	const task = helpingTask({ startDatePlan: 123456, deadline: 234567 });
	const source = { id: 'kanban/1', kanban: true, user: 5, stage: { id: 1 } };
	const target = { ...source, id: 'kanban/2', stage: { id: 2 } };
	const log = jest.spyOn(console, 'log').mockImplementation(() => {});
	try {
		// Проходим общий обработчик drop и настоящий movePosition вплоть до сохранения.
		dashItemsDrop(task, {
			initial: { dropTargets: [{ data: { type: 'cell', cell: source, items: [task] } }] },
			current: { dropTargets: [{ data: { type: 'cell', cell: target, items: [] } }] },
		});
		expect(task.update).toHaveBeenCalledWith({ sorting: 500, stage: 2, stageUser: 5 }, true, null);
		expect(task.user).toBe(7);
		expect(task.startDatePlan).toBe(123456);
		expect(task.deadline).toBe(234567);
	} finally {
		log.mockRestore();
	}
});
