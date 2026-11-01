import React, {
	useRef,
	useEffect,
	useState,
	useContext,
	useCallback,
	Fragment,
} from "react";
import { observer } from "mobx-react";
import { dashItemDragLogic } from "Helpers/DndHelper";
import { get, values } from "mobx";
import { Element } from "react-scroll";

import "./Task.css";
import classNames from "classnames";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import EditItem from "../../EditItem/EditItem";
import ModalLink from "Components/Layout/Modal/ModalLink";
import { Dropdown, Tooltip } from "antd";

const DeadlineCountdown = observer(({ task }) => {
	const remaining = task.deadlineRemainingMs;
	if (remaining === null) return null;

	return (
		<span
			className={classNames("deadlineCountdown", { overdue: remaining < 0 })}
			aria-hidden="true"
		>
			{TimeHelper.strRemaining(remaining)}
		</span>
	);
});

/**
 * Нейтральный отсчёт до плановой даты. Показывается только в канбане: там нет оси времени,
 * а в календаре плановую дату и так показывает положение карточки.
 * Если у задачи есть крайний срок — показываем только его (красный DeadlineCountdown).
 */
const PlanCountdown = observer(({ task, layout }) => {
	if (!layout.kanbanActive) return null;
	if (task.deadline) return null;
	const remaining = task.planRemainingMs;
	if (remaining === null) return null;

	return (
		<span className="planCountdown" aria-hidden="true">
			{TimeHelper.strRemainingCoarse(remaining)}
		</span>
	);
});

const TaskStatusUpdates = observer((props) => {
	//trace();
	const context = useContext(StoreContext);
	const task = get(context.items["task"].items, props.task.id);
	if (!task.updatesCount) return "";
	return (
		<a
			href={task.viewUrl + "#updates"}
			className="task-item-updates"
			title={"Изменения (" + task.updatesCount + ")"}
		>
			{task.updatesCount}
		</a>
	);
});

const TaskStatus = observer((props) => {
	const context = useContext(StoreContext);
	const task = get(context.items["task"].items, props.task.id);
	let onclick = null;
	switch (task.status) {
		case 1:
			onclick = () => task.changeStatus(3);
			break;
		case 2:
			onclick = () => task.changeStatus(3);
			break;
		case 3:
			onclick = () => task.changeStatus(2);
			break;
		default:
			onclick = null;
	}
	return (
		<>
			<span className="msgStatus">
				<span
					className={classNames(
						{ clickable: onclick !== null }, //можно кликнуть чтобы остановить/запустить
						{ red: task.status === -1 }, //просрочено
					)}
					onClick={onclick}
				>
					{task.strStatus}
				</span>
			</span>
			<span className="updates">
				<TaskStatusUpdates task={task} />
			</span>
		</>
	);
});

const TaskDeadline = observer((props) => {
	const context = useContext(StoreContext);
	const task = get(context.items["task"].items, props.task.id);

	let date = "неизв";
	let tips = ["Создана: " + TimeHelper.strDateTimeHumanLong(task.createdAt)];
	if (task.isClosed) {
		tips.push("Закрыта: " + TimeHelper.strDateTimeHumanLong(task.closedDate));
		date = task.closedDateStr;
	} else {
		tips.push(
			"Крайний срок: " +
				(task.deadline
					? TimeHelper.strDateTimeHumanLong(task.deadline)
					: "отсутствует"),
		);
		date = task.deadlineStr;
	}
	if (!task.isClosed && task.startDatePlan)
		tips.push("Запланировано: " + TimeHelper.strDateHumanLong(task.startDatePlan));

	let priorityClass = "";

	switch (task.priority) {
		case 0:
			priorityClass = "lowPriority";
			tips.push("Низкий приоритет");
			break;
		case 1:
			priorityClass = "midPriority";
			tips.push("Средний приоритет");
			break;
		case 2:
			priorityClass = "highPriority";
			tips.push("Высокий приоритет");
			break;
		default:
			priorityClass = "noPriority";
			tips.push("Неизвестный приоритет");
			console.log(props);
			break;
	}

	return (
		<Tooltip
			title={tips.map((line, i) => (
				<Fragment key={i}>
					{line}
					{i < tips.length - 1 && <br />}
				</Fragment>
			))}
		>
			<span className={"deadline " + priorityClass}>{date}</span>
		</Tooltip>
	);
});

function TaskPriority(props) {
	switch (props.priority) {
		case 0:
			return (
				<span className="priority">
					<Tooltip title={"Низкий приоритет"}>
						<span className="taskPriority low" />
					</Tooltip>
				</span>
			);
		case 1:
			return (
				<span className="priority">
					<Tooltip title={"Средний приоритет"}>
						<span className="taskPriority mid" />
					</Tooltip>
				</span>
			);
		case 2:
			return (
				<span className="priority">
					<Tooltip title={"Высокий приоритет"}>
						<span className="taskPriority high" />
					</Tooltip>
				</span>
			);
		default:
			return null;
	}
}

const TaskCard = observer((props) => {
	//trace();
	const ref = useRef(null);
	const context = useContext(StoreContext);
	const task = get(context.items["task"].items, props.task.id);
	//console.log(context);
	const items = context.items;
	const layout = context.layout;
	const users = context.users;
	const cell = props.cell;
	const index = props.index;
	const [closestEdge, setClosestEdge] = useState(null);

	// Оптимизированные обработчики событий для избежания лишних ре-рендеров
	const handleMouseEnter = useCallback(() => task.mouseIn(), [task]);
	const handleMouseLeave = useCallback(() => task.mouseOut(), [task]);

	// Для режима поиска cell может быть null - в таком случае показываем задачу всегда
	// Состав канбана уже отобран StagesStore, включая колонки наблюдателя и постановщика.
	const visible = !cell || cell.kanban || layout.accomplicesVisible || task.user === cell.user;
	//console.log(ref.current);
	useEffect(() => {
		//описание для DND
		const dropData = {
			type: "item", //тип - элемент списка
			element: ref.current, //ссылка на отрисованный элемент
			item: task, //dashItem элемент (task|job|ticket|plan)
			index: index, //порядок элемента в списке
			cell: cell, //ячейка в которой и список и элемент
		};
		if (visible) return dashItemDragLogic(dropData, ref, setClosestEdge);
	}, [ref, visible, cell, index, task]);

	/*const contextMenuClick=(e)=>{
		console.log(e.key);
		switch(e.key) {
			case 'toTop': task.update({ sorting: cell.maxSorting?cell.maxSorting+100:100 }, true); break;
			case 'toBottom': task.update({ sorting: cell.minSorting?cell.minSorting-100:100 }, true); break;
			case 'bucketTop': {
				let bucketTasks=[...values(context.items['task'].items), ...values(context.items['job'].items)].filter((t)=>t.deadline===null && t.isOpen && t.user===cell.user);
				let bucketMaxSorting=bucketTasks.length?Math.max(...bucketTasks.map((t)=>t.sorting))+100:100;
				task.update({ sorting: bucketMaxSorting, deadline: null }, true);
				break;
			}

			case 'bucketBottom': {
				let bucketTasks=[...values(context.items['task'].items), ...values(context.items['job'].items)].filter((t)=>t.deadline===null && t.isOpen && t.user===cell.user);
				let bucketMinSorting=bucketTasks.length?Math.max(...bucketTasks.map((t)=>t.sorting))-100:0;
				task.update({ sorting: bucketMinSorting, deadline: null }, true);
				break;
			}

			case 'failed': task.update({ status: 0 }, true); break;
			case 'partial': task.update({ status: 1 }, true); break;
			case 'complete': task.update({ status: 2 }, true); break;

			default: console.log('unknown menu item: '+e.key);
		}
	}*/

	if (visible)
		return (
			<Dropdown
				menu={{
					items: [...items.contextMenu(task, cell), ...users.contextMenu(task)],
					onClick: items.contextMenuHandler(task, cell),
				}}
				trigger={["contextMenu"]}
				onOpenChange={items.contextMenuOpen(cell)}
			>
				<li
					className={classNames(
						"userItem", //это понятно
						"userTask", //это тоже
						{ dragging: task.isDragging },
						{ updating: task.isUpdating },
						{ alert: task.isAlert },
						{ flash: task.isFlash },
						{ dimmedOut: cell && task.user !== cell.user }, //не своя задача (помогает)
						{ hovered: task.isHovered },
						{ parentTask: task.isHoveredParent },
						{ childTask: task.isHoveredChild },
						{ favorite: task.favorite }, //избранное
						{ activeNow: task.status === 3 }, //в работе
						{ closed: task.isClosed }, //признак что закрыта
						{ negative: task.mark === -1 }, //негативная оценка
						{ closeMe: task.status === 4 }, //признак что требует закрытия (подтверждения)
						{ overdue: task.deadlineRemainingMs < 0 },
					)}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					ref={ref}
					id={task.uid}
				>
					<DeadlineCountdown task={task} />
					<PlanCountdown task={task} layout={layout} />
					<div className="content" name={task.uid}>
						{task.isNew ? (
							<EditItem item={task} items={context.items.tasks} />
						) : (
							<>
								<ModalLink item={task} />
								<span className="userTaskFooter">
									<TaskDeadline task={task} />
									<TaskStatus task={task} />
								</span>
							</>
						)}
					</div>
					{closestEdge && (
						<DropIndicator edge={closestEdge} gap="4px" background="lime" />
					)}
				</li>
			</Dropdown>
		);
});

export default TaskCard;
