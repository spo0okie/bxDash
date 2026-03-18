import React, { useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { StoreContext } from "Data/Stores/StoreProvider";
import "./Data.css";
import UserCellContainer from "./UserCell/UserCellContainer";

/**
 * Компонент данных периода
 * Отображает ячейки пользователей с задачами, работами, тикетами и планами
 * Оптимизирован: использует computed-свойства из PeriodItem и React.memo
 * 
 * @param {Object} props - Свойства компонента
 * @param {number} props.id - Идентификатор периода (timestamp начала дня)
 * @param {number} props.priority - Приоритет (для разбиения корзины)
 */
const PeriodData = observer(({ id, priority=null }) => {
	// Получаем контекст хранилищ
	const context = useContext(StoreContext);
	const users = context.users;
	const period = get(context.periods.periods, id);
	const layout = context.layout;	

	// Используем computed-свойства из PeriodItem
	// Это позволяет избежать повторных вычислений при каждом рендере
	const closedTasks = period.closedTasks;
	const openedTasks = period.openedTasks;
	const closedJobs = period.closedJobs;
	const openedJobs = period.openedJobs;
	const closedTickets = period.closedTickets;
	const openedTickets = period.openedTickets;
	const plans = period.plans;

	let priorityTasks=openedTasks;
	let priorityTickets=openedTickets;
	let priorityJobs=openedJobs;

	if (priority!==null && priority !== undefined) {
		priorityTasks= openedTasks.filter(item => item.priority === priority);
		priorityTickets= openedTickets.filter(item => item.priority === priority);
		priorityJobs= openedJobs.filter(item => item.priority === priority);
	}

	return (
		<div className="PeriodData">
			<table className="UserCells">
				<tbody>
					<tr>
						{users.order.map((userId) => (
							<UserCellContainer
								key={'cell' + id + '/' + userId}
								userId={userId}
								period={period}
								closedTasks={closedTasks}
								openedTasks={priorityTasks}
								closedJobs={closedJobs}
								openedJobs={priorityJobs}
								closedTickets={closedTickets}
								openedTickets={priorityTickets}
								plans={plans}
								layout={layout}
								items={context.items}
								priority={priority}
							/>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	);
});

export default PeriodData;
