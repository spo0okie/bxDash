import React, { useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import PeriodTitle from "./Title/Title";
import PeriodData from "./Data/Data";
import { StoreContext } from "Data/Stores/StoreProvider";

import './Period.css';
import { Element } from "react-scroll";

/**
 * Компонент периода (дня)
 * Отображает заголовок и данные периода
 * @param {Object} props - Свойства компонента
 * @param {number} props.id - Идентификатор периода (timestamp начала дня)
 * @param {number} props.priority - Приоритет периода (для разделения корзины)
 */
const Period = observer(({ id, priority=null }) => {
	// Получаем контекст хранилищ
	const context = useContext(StoreContext);
	
	/**
	 * Определяет CSS-класс для layout периода
	 * В режиме по умолчанию - строка с пользователями по горизонтали
	 * В персональном режиме - колонка
	 */
	const layoutClass = () => {
		return context.users.selected === null ? 'row' : 'column';
	};

	// Получаем данные периода
	const period = get(context.periods.periods, id);

	return (
		<Element className={"Period " + layoutClass() + ' ' + period.className} name={'period' + id}>
			<div className="periodContent">
				<PeriodTitle id={id} priority={priority} key={id + '.title'+(priority? '-' + priority : '')} />
				<PeriodData id={id} priority={priority} key={id+(priority? '-' + priority : '')} />
			</div>
		</Element>
	);
});

export default Period;
