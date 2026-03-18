import React, { useMemo } from "react";
import { observer } from "mobx-react";
import UserCell from "./UserCell";
import UserCellHeader from "./UserCellHeader";
import CardsBlock from "./CardsBlock";
import CreateItemButton from "Components/Items/CreateItemButton/CreateItemButton";
import { userPeriodAbsentsGradient } from "Helpers/IntervalHelper";
import { dashClosedItemsSort, dashItemsSort } from "Helpers/SortHelper";

/**
 * Контейнер ячейки пользователя с мемоизацией фильтрации
 * Оптимизирован с помощью observer из mobx-react для реактивности
 * и useMemo для фильтрации данных по пользователю
 * 
 * @param {Object} props - Свойства компонента
 * @param {string} props.userId - ID пользователя
 * @param {Object} props.period - Объект периода (PeriodItem)
 * @param {Array} props.closedTasks - Закрытые задачи (из computed-свойства)
 * @param {Array} props.openedTasks - Открытые задачи (из computed-свойства)
 * @param {Array} props.closedJobs - Закрытые работы (из computed-свойства)
 * @param {Array} props.openedJobs - Открытые работы (из computed-свойства)
 * @param {Array} props.closedTickets - Закрытые тикеты (из computed-свойства)
 * @param {Array} props.openedTickets - Открытые тикеты (из computed-свойства)
 * @param {Array} props.plans - Планы (из computed-свойства)
 * @param {Object} props.layout - LayoutStore для доступа к настройкам
 * @param {Object} props.items - ItemsMultiStore для доступа к данным отсутствий
 */
const UserCellContainer = observer(({ 
	userId, 
	period,
	closedTasks,
	openedTasks,
	closedJobs,
	openedJobs,
	closedTickets,
	openedTickets,
	plans,
	layout,
	items,
	priority
}) => {
	// Мемоизированная фильтрация по пользователю
	// Выполняется только при изменении входных данных
	const userItems = useMemo(() => {
		// Фильтруем задачи (учитываем соисполнителей если включено)
		const uClosedTasks = closedTasks.filter(
			(item) => item.user === userId || (layout.accomplicesVisible && item.accomplices.includes(userId))
		);
		const uOpenedTasks = openedTasks.filter(
			(item) => item.user === userId || (layout.accomplicesVisible && item.accomplices.includes(userId))
		);
		
		// Фильтруем работы, тикеты и планы (только по ответственному)
		const uClosedJobs = closedJobs.filter((item) => item.user === userId);
		const uOpenedJobs = openedJobs.filter((item) => item.user === userId);
		const uClosedTickets = closedTickets.filter((item) => item.user === userId);
		const uOpenedTickets = openedTickets.filter((item) => item.user === userId);
		const uPlans = plans.filter((item) => item.user === userId);

		// Сортировка открытых элементов по убыванию sorting
		const openedItems = [...uOpenedTasks, ...uOpenedJobs, ...uOpenedTickets].sort((a, b) => dashItemsSort(b, a));
		
		// Сортировка закрытых элементов по убыванию sorting
		const closedItems = [...uPlans, ...uClosedJobs, ...uClosedTasks, ...uClosedTickets].sort((a, b) => dashClosedItemsSort(b, a));

		return {
			uClosedTasks,
			uOpenedTasks,
			uClosedJobs,
			uOpenedJobs,
			uClosedTickets,
			uOpenedTickets,
			uPlans,
			openedItems,
			closedItems
		};
	}, [userId, closedTasks, openedTasks, closedJobs, openedJobs, closedTickets, openedTickets, plans, layout.accomplicesVisible]);

	// Формируем уникальный ID ячейки
	const cellId = 'cell' + period.start + '/' + userId + (priority===null?'':('/'+priority));
	
	// Вычисляем градиент фона на основе отсутствий
	// items['absent'] — ItemsStore с данными об отсутствиях пользователей
	const cellOptions = userPeriodAbsentsGradient(
		items['absent'],
		period.start,
		period.end,
		userId
	);

	// Формируем объект ячейки для DnD
	const cell = {
		t: period.start,              // Временная отметка
		user: userId,                 // Пользователь
		id: cellId,                   // Ключ
		dropT: period.dropTime,       // Время для падающих задач
		period: period,
		priority: priority,
		maxSorting: userItems.openedItems.length ? userItems.openedItems[0].sorting : null,
		minSorting: userItems.openedItems.length ? userItems.openedItems[userItems.openedItems.length - 1].sorting : null,
		dragOver: (value) => {
			if (value) {
				period.setDragOverCell(cellId);
			} else {
				period.setDragOverCell(null);
			}
		}
	};

	return (
		<UserCell key={cellId} user={userId} period={period.start} id={cellId}>
			<div className="userCellContent" style={{ background: cellOptions.background }} title={cellOptions.title}>
				<UserCellHeader
					key={'header' + cellId}
					closedTasks={userItems.uClosedTasks}
					openedTasks={userItems.uOpenedTasks}
					closedJobs={userItems.uClosedJobs}
					openedJobs={userItems.uOpenedJobs}
					closedTickets={userItems.uClosedTickets}
					openedTickets={userItems.uOpenedTickets}
				/>
				<CardsBlock key={'closed' + cellId} items={userItems.closedItems} cell={cell} dnd={false} />
				<CreateItemButton cell={cell} />
				{period.isOpen && <CardsBlock key={'open' + cellId} items={userItems.openedItems} cell={cell} dnd={true} />}
			</div>
		</UserCell>
	);
});

// observer уже обеспечивает оптимизацию перерисовок через MobX-реактивность
// React.memo убран, так как arePropsEqual не учитывал изменения массивов данных
export default UserCellContainer;
