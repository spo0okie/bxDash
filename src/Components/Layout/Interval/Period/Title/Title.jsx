import React, { useCallback, useContext } from "react";
import { observer } from "mobx-react";
import { get } from "mobx"
import './Title.css';
import { StoreContext } from "Data/Stores/StoreProvider";
import { Button, Tooltip } from "antd";

/**
 * Компонент заголовка периода с кнопками навигации по неделям
 */
const PeriodTitle = observer((props) => {
	const context = useContext(StoreContext);
	const id = props.id;
	const period = get(context.periods.periods, id);
	const time = context.time;
	const layout = context.layout;
	const priority = props.priority??null;

	const priorityTitles=['Отложено', 'Средний приоритет', 'Высокий приоритет'];

	// Обработчики событий с useCallback для оптимизации
	const handleDecWeekMin = useCallback(() => time.decWeekMin(), [time]);
	const handleIncWeekMin = useCallback(() => time.incWeekMin(), [time]);
	const handleDecWeekMax = useCallback(() => time.decWeekMax(), [time]);
	const handleIncWeekMax = useCallback(() => {
		time.incWeekMax();
		setTimeout(() => {
			layout.scrollToLastWeek();
		}, 100);
	}, [time, layout]);

	return (
		<div className="PeriodTitle">
			{period.start === time.firstWeekStart() && (
				<span className="prevWeekButton">
					<Tooltip title={'Добавить предыдущую неделю'}>
						<Button className='add' onClick={handleDecWeekMin} />
					</Tooltip>
					{time.weekMin < 0 && (
						<Tooltip title={'Убрать эту неделю с доски'}>
							<Button onClick={handleIncWeekMin}>X</Button>
						</Tooltip>
					)}
				</span>
			)}
			<Tooltip title={period.toolTip}>
				<h3>{priority !== null ? priorityTitles[priority] : period.title}</h3>
			</Tooltip>
			{period.end === time.lastWeekEnd() && (
				<span className="nextWeekButton">
					{time.weekMax > 0 && (
						<Tooltip title={'Убрать эту неделю с доски'}>
							<Button onClick={handleDecWeekMax}>X</Button>
						</Tooltip>
					)}
					<Tooltip title={'Добавить следующую неделю'}>
						<Button className='add' onClick={handleIncWeekMax} />
					</Tooltip>
				</span>
			)}
		</div>
	);
});

export default PeriodTitle;
