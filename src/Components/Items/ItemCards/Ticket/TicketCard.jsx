import React, { useRef, useContext, useCallback, useEffect, useState, Fragment } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { Dropdown, Tooltip } from "antd";

import "./TicketCard.css";
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import ModalLink from "Components/Layout/Modal/ModalLink";
import { dashItemDragLogic } from "Helpers/DndHelper";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";

const SlaCountdown = observer(({ item }) => {
	// item.slaRemainingMs подписан на time.strTime — observer пересчитает раз в секунду.
	const remaining = item.slaRemainingMs;
	if (remaining === null) return null;

	return (
		<span
			className={classNames("slaCountdown", { overdue: remaining < 0 })}
			aria-hidden="true"
		>
			{TimeHelper.strRemaining(remaining)}
		</span>
	);
});

const TicketCard = observer((props) => {
	//trace();
	const ref = useRef(null);
	const context = useContext(StoreContext);
	const item = get(context.items["ticket"].items, props.item.id);
	const cell = props.cell;
	const index = props.index;
	const [closestEdge, setClosestEdge] = useState(null);

	// Заявку можно перетаскивать только между столбцами канбана: там меняется лишь её столбец.
	// В календаре заявка привязана к своему сроку SLA и не двигается, как и раньше.
	const draggableHere = Boolean(cell?.kanban);
	useEffect(() => {
		if (!draggableHere) return undefined;
		return dashItemDragLogic({
			type: "item",
			element: ref.current,
			item: item,
			index: index,
			cell: cell,
		}, ref, setClosestEdge);
	}, [draggableHere, item, cell, index]);

	// Мемоизированные обработчики событий для предотвращения лишних ре-рендеров
	const handleMouseEnter = useCallback(() => item.mouseIn(), [item]);
	const handleMouseLeave = useCallback(() => item.mouseOut(), [item]);

	//console.log(item);

	const TicketDeadline = observer((props) => {
		const task = props.item;

		let date = TimeHelper.strDateHuman(task.createdAt);
		let tips = ["Создана: " + TimeHelper.strDateTimeHumanLong(task.createdAt)];
		if (task.isClosed) {
			tips.push("Закрыта: " + TimeHelper.strDateTimeHumanLong(task.closedDate));
			date = task.closedDateStr;
			tips.push("Выполнено за " + item.workDaysToClose.toFixed(1) + "дн");
		} else {
			/*tips.push(
				"Крайний срок: " + TimeHelper.strDateTimeHumanLong(task.deadline),
			);*/
			if (task.slaDeadlineMs) {
				tips.push(
					"Крайний срок SLA: " +
						TimeHelper.strDateTimeHumanLong(task.slaDeadlineMs),
				);
				const nonWork = task.slaNonWorkDays;
				if (nonWork > 0) {
					tips.push("Нерабочих дней до SLA: " + nonWork);
				}
			}
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
				<span className="deadline">
					{item.isClosed ? item.workDaysToClose.toFixed(1) : date}
				</span>
			</Tooltip>
		);
	});

	const overdue = item.isSlaOverdue;

	// Заявку дашборд не правит, поэтому контекстное меню у неё одно: «В столбец» канбан-доски.
	const menuItems = cell ? context.items.stageMenu(item, cell) : [];

	const card = (
		<li
			className={classNames(
				"userItem", //это понятно
				"userTicket", //это тоже
				{ dragging: item.isDragging },
				{ updating: item.isUpdating },
				{ alert: item.isAlert },
				{ flash: item.isFlash },

				{ hovered: item.isHovered },
				{ parentTicket: item.isHoveredParent },
				{ childTicket: item.isChildHovered() },

				{ closed: item.isClosed && item.status !== "blue" }, //признак что закрыта

				{ green: !item.isClosed && item.status === "green" && !overdue }, //зеленый
				{ red: (!item.isClosed && item.status === "red") || overdue }, //красный
				{ blue: item.status === "blue" }, //красный
			)}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			//onClick={()=>{item.startEdit()}}
			ref={ref}
			//title={item.sorting}
		>
			<SlaCountdown item={item} />
			<div className="content" name={item.uid}>
				<ModalLink item={item} />
				<TicketDeadline item={item} />
			</div>
			{closestEdge && <DropIndicator edge={closestEdge} gap="4px" background="lime" />}
		</li>
	);

	if (!menuItems.length) return card;

	return (
		<Dropdown
			menu={{ items: menuItems, onClick: context.items.contextMenuHandler(item, cell) }}
			trigger={["contextMenu"]}
			onOpenChange={context.items.contextMenuOpen(cell)}
		>
			{card}
		</Dropdown>
	);
});

export default TicketCard;
