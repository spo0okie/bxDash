import React, {useRef,useEffect,useContext} from "react";
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import TaskCard from "Components/Items/ItemCards/Task/TaskCard";
import JobCard from "Components/Items/ItemCards/Job/JobCard";
import TicketCard from "Components/Items/ItemCards/Ticket/TicketCard";
import PlanCard from "Components/Items/ItemCards/Plan/PlanCard";
import MemoCard from "Components/Items/ItemCards/Memo/MemoCard";
import classNames from "classnames";
import { observer } from "mobx-react";
import { StoreContext } from "Data/Stores/StoreProvider";

import './CardsBlock.css';


const CardsBlock = observer((props) => {
	const ref = useRef(null);
	const items=props.items;
	const cell=props.cell;
	const context = useContext(StoreContext);

	const showJobs = context.layout.jobsVisible;
	const showTasks = context.layout.tasksVisible;
	const showTickets = context.layout.ticketsVisible;
	const showPlans = context.layout.plansVisible
	const keepPlanning = context.layout.keepPlanning;
	//console.log('card');

	if (props.dnd) useEffect(() => {
		//console.log(dropTargetData);
		return dropTargetForElements({
			element: ref.current,
			getData: () => {return{
				type: 'cell',
				items: items,
				cell:cell
			}},
			//getInitialData: () => dropTargetData,
			onDrag({source}) {
				//cell.dragOver(true);
				if (source.data.setCell)					//если над нами тащат карточку, 
					source.data.setCell(cell); //то мы карточке передаем что у нее новый таргет
			},
			onDragLeave() {
				//cell.dragOver(false);
			},
			canDrop({ source }) {
				//нельзя бросать на недвижимые элементы списка, и на самого себя (ну или можно но надо обработать как то иначе)
				return (source.data.type==='item');// && dropData.item.isDraggable(dropData.cell); // && source.element !== dropData.element;
			},
		});
	}, [cell,items]);

	let cards=[];
	items.forEach((item, i) => {
		if (item.type === 'task' && (showTasks || (keepPlanning && item.isPlanItem())))
			cards.push(<TaskCard
				key={item.uid + '/' + cell.user}
				task={item}
				index={i}
				cell={cell}
			/>);
		if (item.type === 'job' && (showJobs || (keepPlanning && item.isPlanItem())))
			cards.push(<JobCard
				key={item.uid + '/' + cell.user}
				job={item}
				index={i}
				cell={cell}
			/>);
		if (item.type === 'plan' && (showPlans || (keepPlanning && item.isPlanItem())))
			cards.push(<PlanCard
				key={item.uid + '/' + cell.user}
				plan={item}
				index={i}
				cell={cell}
			/>);
		if (item.type === 'ticket' && (showTickets || (keepPlanning && item.isPlanItem())))
			cards.push(<TicketCard
				key={item.uid + '/' + cell.user}
				item={item}
				index={i}
				cell={cell}
			/>);
		if (item.type === 'memo')
			cards.push(<MemoCard
				key={item.uid}
				item={item}
				index={i}
				cell={cell}
			/>);
		//if (item.isPlanItem()) cards.push('plan');
	});

	return (<ul 
		className={classNames(
			{'droppableBlock':props.dnd}, 
		)} 
		ref={ref}
	>
		{cards}

	</ul>);
});
export default CardsBlock;