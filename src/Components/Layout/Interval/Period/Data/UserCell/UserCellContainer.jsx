import React, { useMemo } from "react";
import { observer } from "mobx-react";
import UserCell from "./UserCell";
import UserCellHeader from "./UserCellHeader";
import CardsBlock from "./CardsBlock";
import CreateItemButton from "Components/Items/CreateItemButton/CreateItemButton";
import PeriodItem from "Data/Stores/Periods/PeriodItem";
import { userPeriodAbsentsGradient } from "Helpers/IntervalHelper";
import { dashClosedItemsSort, dashItemsSort } from "Helpers/SortHelper";

/**
 * Контейнер ячейки пользователя.
 *
 * Получает уже сгруппированные по userId элементы из PeriodItem.itemsByUser,
 * фильтрует по priority (split-bucket режим) и сортирует.
 * Сам не делает ни прохода по соисполнителям, ни map'а по типам.
 *
 * @param {string} props.userId  - ID пользователя
 * @param {Object} props.period  - PeriodItem
 * @param {number|null} props.priority - приоритет (для split-bucket); null = без фильтра
 * @param {Object} props.layout  - LayoutStore
 * @param {Object} props.items   - ItemsMultiStore (для absent данных и контекстных меню)
 */
const UserCellContainer = observer(({ userId, period, priority, layout, items }) => {
	// Доступ к computed индексу периода (pass-1: группировка по пользователю
	// делается один раз на период, а не на каждую ячейку).
	const userItems = period.itemsByUser.get(userId) ?? PeriodItem.EMPTY_USER_ITEMS;

	const cellItems = useMemo(() => {
		// Pass-2: priority-фильтр в split-bucket. Только открытые — у закрытых
		// приоритет уже не имеет смысла (соответствует прежней семантике в Data.jsx).
		const hasPriority = priority !== null && priority !== undefined;
		const openedTasks   = hasPriority ? userItems.openedTasks.filter(i => i.priority === priority)   : userItems.openedTasks;
		const openedJobs    = hasPriority ? userItems.openedJobs.filter(i => i.priority === priority)    : userItems.openedJobs;
		const openedTickets = hasPriority ? userItems.openedTickets.filter(i => i.priority === priority) : userItems.openedTickets;

		const openedItems = [...openedTasks, ...openedJobs, ...openedTickets].sort((a, b) => dashItemsSort(b, a));
		const closedItems = [...userItems.plans, ...userItems.closedJobs, ...userItems.closedTasks, ...userItems.closedTickets].sort((a, b) => dashClosedItemsSort(b, a));

		return {
			uClosedTasks: userItems.closedTasks,
			uOpenedTasks: openedTasks,
			uClosedJobs: userItems.closedJobs,
			uOpenedJobs: openedJobs,
			uClosedTickets: userItems.closedTickets,
			uOpenedTickets: openedTickets,
			openedItems,
			closedItems,
		};
	}, [userItems, priority]);

	const cellId = 'cell' + period.start + '/' + userId + (priority === null ? '' : ('/' + priority));

	const cellOptions = userPeriodAbsentsGradient(items['absent'], period.start, period.end, userId);

	const cell = {
		t: period.start,
		user: userId,
		id: cellId,
		dropT: period.dropTime,
		period: period,
		priority: priority,
		maxSorting: cellItems.openedItems.length ? cellItems.openedItems[0].sorting : null,
		minSorting: cellItems.openedItems.length ? cellItems.openedItems[cellItems.openedItems.length - 1].sorting : null,
		dragOver: value => period.setDragOverCell(value ? cellId : null),
	};

	return (
		<UserCell key={cellId} user={userId} period={period.start} id={cellId}>
			<div className="userCellContent" style={{ background: cellOptions.background }} title={cellOptions.title}>
				<UserCellHeader
					key={'header' + cellId}
					closedTasks={cellItems.uClosedTasks}
					openedTasks={cellItems.uOpenedTasks}
					closedJobs={cellItems.uClosedJobs}
					openedJobs={cellItems.uOpenedJobs}
					closedTickets={cellItems.uClosedTickets}
					openedTickets={cellItems.uOpenedTickets}
				/>
				<CardsBlock key={'closed' + cellId} items={cellItems.closedItems} cell={cell} dnd={false} />
				<CreateItemButton cell={cell} />
				{period.isOpen && <CardsBlock key={'open' + cellId} items={cellItems.openedItems} cell={cell} dnd={true} />}
			</div>
		</UserCell>
	);
});

export default UserCellContainer;
