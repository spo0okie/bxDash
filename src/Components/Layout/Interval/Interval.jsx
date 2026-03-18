import React, { useContext } from "react";
import { observer } from "mobx-react";
import { keys } from "mobx";
import { StoreContext } from "Data/Stores/StoreProvider";
import Period from "./Period/Period";
import './Interval.css';
import { Element } from "react-scroll";

/**
 * Компонент интервала (недели)
 * Отображает периоды, попадающие в данный интервал времени
 * @param {Object} props - Свойства компонента
 * @param {number} props.id - Идентификатор интервала (номер недели)
 */
const Interval = observer(({ id, priority=null }) => {
	// Получаем контекст хранилищ
	const context = useContext(StoreContext);
	const layout = context.layout;
	const users = context.users;
	const periods = context.periods;
	const time = context.time;
	
	// Вычисляем границы интервала
	const start = time.weekStart(id);
	const end = time.weekEnd(id);

	// Определяем CSS-класс в зависимости от режима отображения
	let intervalClass = "Interval";
	if (users.selected === null) {
		// Режим по умолчанию - строка с пользователями по горизонтали
		intervalClass += " row";
	} else {
		// Персональный режим
		if (layout.expand) {
			intervalClass += (id > time.weekMax ? " columnBucket" : " personalRow");
		} else {
			intervalClass += (id > time.weekMax ? " columnBucket" : " column");
		}
	}

	return (
		<Element name={'interval' + id} className={intervalClass}>
			{
				// Фильтруем периоды, попадающие в интервал, и рендерим их
				keys(periods.periods)
					.filter((t) => (t >= start) && (t < end))
					.map((t) => <Period id={t} key={t} priority={priority} />)
			}
		</Element>
	);
});

export default Interval;
