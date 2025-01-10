import React, {useRef,useEffect,useState,useContext} from "react";
import {observer} from "mobx-react";
import { get, trace } from "mobx"
import { Element} from 'react-scroll';


import './TicketCard.css'
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import ModalLink from "Components/Layout/Modal/ModalLink";




const TicketCard = observer((props)=>{
	//trace();
	const ref = useRef(null);
	const context=useContext(StoreContext);
	const item = get(context.items['ticket'].items,props.item.id);

	//console.log(item);

	const TicketDeadline = (props) => {
		const task = props.item;

		let date = TimeHelper.strDateHuman(task.createdAt);
		let tips = [
			'Создана: ' + TimeHelper.strDateTimeHumanLong(task.createdAt)
		];
		if (task.isClosed) {
			tips.push('Закрыта: ' + TimeHelper.strDateTimeHumanLong(task.closedDate))
			date = task.closedDateStr;
		} else {
			tips.push('Крайний срок: ' + TimeHelper.strDateTimeHumanLong(task.deadline))
			//date = task.deadlineStr;
		}

		return (<span className="deadline" title={tips.join("\n")}>{date}</span>);
	};

	return( <li 
		className={classNames(
			'userItem',		//это понятно
			'userTicket',		//это тоже
			{'updating':item.isUpdating},
			{'alert':item.isAlert},
			{ 'flash': item.isFlash },

			{'hovered':item.isHovered},
			{'parentTicket':item.isHoveredParent},
			{'childTicket':item.isChildHovered()},

			{ 'closed': item.isClosed && item.status !== 'blue' },		//признак что закрыта

			{ 'green': !item.isClosed && item.status==='green'},		//зеленый
			{ 'red': !item.isClosed && item.status === 'red' },		//красный
			{ 'blue': item.status === 'blue' },		//красный
		)}

		onMouseEnter={()=>item.mouseIn()}
		onMouseLeave={()=>item.mouseOut()}
		//onClick={()=>{item.startEdit()}}
		ref={ref}
		//title={item.sorting}
	>
		<div className="content">
			<Element name={item.uid}>
				<ModalLink item={item} />
				<TicketDeadline item={item} />
			</Element>
		</div>
	</li>);
})

export default TicketCard;