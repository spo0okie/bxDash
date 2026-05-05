import React, { useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { StoreContext } from "Data/Stores/StoreProvider";
import "./Data.css";
import UserCellContainer from "./UserCell/UserCellContainer";

/**
 * Компонент данных периода. Рендерит ячейки по списку пользователей.
 *
 * Фильтрация и группировка элементов делегирована PeriodItem.itemsByUser
 * (computed) — здесь только композиция: id, период, userId, опциональный priority.
 *
 * @param {number} props.id - timestamp начала периода
 * @param {number} [props.priority] - приоритет для split-bucket режима
 */
const PeriodData = observer(({ id, priority = null }) => {
	const context = useContext(StoreContext);
	const users = context.users;
	const period = get(context.periods.periods, id);
	const layout = context.layout;

	return (
		<div className="PeriodData">
			<table className="UserCells">
				<tbody>
					<tr>
						{users.order.map(userId => (
							<UserCellContainer
								key={'cell' + id + '/' + userId}
								userId={userId}
								period={period}
								priority={priority}
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
