import React, { useCallback } from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import { classForType } from "Data/itemTypes";

import "Components/Items/CreateItemButton/CreateItemButton.css";

/**
 * Кнопки создания элемента в столбце канбана.
 *
 * Календарный CreateItemButton завязан на период (сегодня/прошлое/будущее), которого у столбца нет.
 * В столбце создаём элемент БЕЗ плановой даты (как в долгом ящике) и сразу с привязкой к столбцу —
 * DashItem.save отправит её вместе с остальными полями.
 */
const KanbanCreateButton = observer(({ cell }) => {
	const { items, layout } = useStores();

	const create = useCallback((type, dateField) => {
		const store = items[type];
		const ItemClass = classForType(type);
		const item = new ItemClass(
			{
				id: store.getMaxId() + 64,
				user: cell.user,
				[dateField]: null,
				isNew: true,
				isEdit: true,
				sorting: cell.maxSorting ? cell.maxSorting + 20 : null,
			},
			{},
			store,
		);
		item.setStage(cell.user, cell.stage.id);
		store.setItem(item);
	}, [items, cell]);

	const createTask = useCallback(() => create('task', 'startDatePlan'), [create]);
	const createJob = useCallback(() => create('job', 'deadline'), [create]);

	return (
		<span className="CreateItemButton">
			{layout.jobsVisible && <span className="create job" onClick={createJob}>работа</span>}
			{layout.tasksVisible && <span className="create task" onClick={createTask}>задача</span>}
		</span>
	);
});

export default KanbanCreateButton;
