import React, { useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { StoreContext } from "Data/Stores/StoreProvider";
import "./Data.css";
import UserCell from "./UserCell/UserCell";
import { dashClosedItemsSort, dashItemsSort } from "Helpers/SortHelper";
import UserCellHeader from "./UserCell/UserCellHeader";
import { userPeriodAbsentsGradient } from "Helpers/IntervalHelper";
import CardsBlock from "./UserCell/CardsBlock";
import CreateItemButton from "Components/Items/CreateItemButton/CreateItemButton";

/**
 * Компонент данных периода
 * Отображает ячейки пользователей с задачами, работами, тикетами и планами
 * @param {Object} props - Свойства компонента
 * @param {number} props.id - Идентификатор периода (timestamp начала дня)
 */
const PeriodData = observer(({ id }) => {
	// Получаем контекст хранилищ
	const context = useContext(StoreContext);
	const users = context.users;
	const period = get(context.periods.periods, id);
	const layout = context.layout;

	// Собираем элементы по типам для текущего периода
	const items = {};

	// Перебираем типы элементов (task, job, ticket, plan, absent)
	context.items.types.forEach(type => {
		items[type] = [];

		// Перебираем ID элементов этого типа в этом периоде
		get(period.itemsIds.ids, type).forEach(itemId => {
			items[type].push(
				get(context.items[type].items, itemId)
			);
		});
	});

	// Разделяем задачи на открытые и закрытые
	const closedTasks = items['task'].filter((task) => task.isClosed);
	const openedTasks = items['task'].filter((task) => !task.isClosed);

	// Разделяем работы на открытые и закрытые
	const closedJobs = items['job'].filter((job) => job.isClosed);
	const openedJobs = items['job'].filter((job) => !job.isClosed);

	// Разделяем тикеты на открытые и закрытые
	const closedTickets = items['ticket'].filter((item) => item.isClosed);
	const openedTickets = items['ticket'].filter((item) => !item.isClosed);

	// Планы не делим на открытые/закрытые
	const plans = items['plan'];

	return (
		<div className="PeriodData">
			<table className="UserCells">
				<tbody>
					<tr>
						{users.order.map((i) => {
							// Формируем уникальный ID ячейки
							const cellId = 'cell' + id + '/' + i;

							// Вычисляем градиент фона на основе отсутствий
							const cellOptions = userPeriodAbsentsGradient(
								context.items['absent'],
								period.start,
								period.end,
								i,
							);

							// Фильтруем элементы для текущего пользователя
							const uClosedTasks = closedTasks.filter((item) => item.user === i || (layout.accomplicesVisible && item.accomplices.includes(i)));
							const uOpenedTasks = openedTasks.filter((item) => item.user === i || (layout.accomplicesVisible && item.accomplices.includes(i)));
							const uClosedJobs = closedJobs.filter((item) => item.user === i);
							const uOpenedJobs = openedJobs.filter((item) => item.user === i);
							const uClosedTickets = closedTickets.filter((item) => item.user === i);
							const uOpenedTickets = openedTickets.filter((item) => item.user === i);
							const uPlans = plans.filter((item) => item.user === i);

							// Формируем списки открытых и закрытых элементов
							let openedItems = [];
							let closedItems = [];

							// Открытые элементы (сортировка по убыванию sorting)
							openedItems.push(...uOpenedTasks);
							openedItems.push(...uOpenedJobs);
							openedItems.push(...uOpenedTickets);
							openedItems = openedItems.sort((a, b) => dashItemsSort(b, a));

							// Закрытые элементы (сортировка по убыванию sorting)
							closedItems.push(...uPlans);
							closedItems.push(...uClosedJobs);
							closedItems.push(...uClosedTasks);
							closedItems.push(...uClosedTickets);
							closedItems = closedItems.sort((a, b) => dashClosedItemsSort(b, a));

							// Формируем объект ячейки для DnD
							const cell = {
								t: id,						// Временная отметка
								user: i,					// Пользователь
								id: cellId,					// Ключ
								dropT: period.dropTime,		// Время для падающих задач
								period: period,
								maxSorting: openedItems.length ? openedItems[0].sorting : null,
								minSorting: openedItems.length ? openedItems[openedItems.length - 1].sorting : null,
								dragOver: (value) => {
									if (value) {
										period.setDragOverCell(cellId);
									} else {
										period.setDragOverCell(null);
									}
								}
							};

							return (
								<UserCell key={cellId} user={i} period={id} id={cellId}>
									<div className="userCellContent" style={{ background: cellOptions.background }} title={cellOptions.title}>
										<UserCellHeader
											key={'header' + cellId}
											closedTasks={uClosedTasks}
											openedTasks={uOpenedTasks}
											closedJobs={uClosedJobs}
											openedJobs={uOpenedJobs}
											closedTickets={uClosedTickets}
											openedTickets={uOpenedTickets}
										/>
										<CardsBlock key={'closed' + cellId} items={closedItems} cell={cell} dnd={false} />
										<CreateItemButton cell={cell} />
										{period.isOpen && <CardsBlock key={'open' + cellId} items={openedItems} cell={cell} dnd={true} />}
									</div>
								</UserCell>
							);
						})}
					</tr>
				</tbody>
			</table>
		</div>
	);
});

export default PeriodData;
