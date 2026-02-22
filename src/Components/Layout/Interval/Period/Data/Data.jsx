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
 */
const PeriodData = observer(({ id }) => {
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
								openedTasks={openedTasks}
								closedJobs={closedJobs}
								openedJobs={openedJobs}
								closedTickets={closedTickets}
								openedTickets={openedTickets}
								plans={plans}
								layout={layout}
								items={context.items}
							/>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	);
});

export default PeriodData;
