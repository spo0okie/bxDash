import React, { useRef, useContext, useCallback, Fragment } from "react";
import { observer } from "mobx-react";
import { get } from "mobx";
import { Tooltip } from "antd";

import "./TicketCard.css";
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import ModalLink from "Components/Layout/Modal/ModalLink";

function formatRemaining(ms) {
	const negative = ms < 0;
	const abs = Math.abs(ms);
	const totalSec = Math.floor(abs / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	const pad = (n) => String(n).padStart(2, "0");
	return negative ? "" : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const SlaCountdown = observer(({ item, time }) => {
	const deadlineMs = item.slaDeadlineMs;
	if (deadlineMs === null) return null;

	// Подписка на time.strTime даёт перерисовку раз в секунду.
	void time.strTime;

	const remaining = deadlineMs - Date.now();
	const text = formatRemaining(remaining);

	return (
		<span
			className={classNames("slaCountdown", { overdue: remaining < 0 })}
			aria-hidden="true"
		>
			{text}
		</span>
	);
});

const TicketCard = observer((props) => {
	//trace();
	const ref = useRef(null);
	const context = useContext(StoreContext);
	const item = get(context.items["ticket"].items, props.item.id);

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
		} else {
			tips.push(
				"Крайний срок: " + TimeHelper.strDateTimeHumanLong(task.deadline),
			);
			if (task.slaDeadlineMs) {
				tips.push(
					"Крайний срок SLA: " + TimeHelper.strDateTimeHumanLong(task.slaDeadlineMs),
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
				<span className="deadline">{date}</span>
			</Tooltip>
		);
	});

	return (
		<li
			className={classNames(
				"userItem", //это понятно
				"userTicket", //это тоже
				{ updating: item.isUpdating },
				{ alert: item.isAlert },
				{ flash: item.isFlash },

				{ hovered: item.isHovered },
				{ parentTicket: item.isHoveredParent },
				{ childTicket: item.isChildHovered() },

				{ closed: item.isClosed && item.status !== "blue" }, //признак что закрыта

				{ green: !item.isClosed && item.status === "green" }, //зеленый
				{ red: !item.isClosed && item.status === "red" }, //красный
				{ blue: item.status === "blue" }, //красный
			)}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			//onClick={()=>{item.startEdit()}}
			ref={ref}
			//title={item.sorting}
		>
			<SlaCountdown item={item} time={context.time} />
			<div className="content" name={item.uid}>
				<ModalLink item={item} />
				<TicketDeadline item={item} />
			</div>
		</li>
	);
});

export default TicketCard;
