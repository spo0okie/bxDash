import React, {useRef,useEffect,useState,useContext} from "react";
import {observer} from "mobx-react";
import { dashItemDragLogic } from "Data/Items/DashItem";
import {get,trace} from "mobx"
import { Element} from 'react-scroll';

import './Task.css'
import classNames from "classnames";
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import EditItem from "../../EditItem/EditItem";
import ModalLink from "Components/Layout/Modal/ModalLink";


const TaskStatusUpdates=observer((props)=>{
	const task=props.task;
	if (!task.updatesCount) return '';
	return(<a href={task.viewUrl+'#updates'} className="task-item-updates" title={'Изменения ('+task.updatesCount+')'}>
		<span className="task-item-updates-inner">{task.updatesCount}</span>
	</a>);
})


const TaskStatus=observer((props)=>{
	const task=props.task;
	let onclick=null;
	switch (task.status) {
		case 1:     onclick=()=>task.changeStatus(3); break;
		case 2:     onclick=()=>task.changeStatus(3); break;
		case 3:     onclick=()=>task.changeStatus(2); break;
	}
	return (
	<span className="msgStatus">
		<span className={classNames(
			{'clickable':onclick!==null},	//можно кликнуть чтобы остановить/запустить
			{'red':task.status===-1}	//просрочено
		)} onClick={onclick}>
			{task.strStatus}
		</span>
		<TaskStatusUpdates task={task} />
	</span>)
});


const TaskDeadline=observer((props)=>{
	const task=props.task;
	let onclick=null;

	let date='неизв';
	let tips=[
		'Создана: '+TimeHelper.strDateTimeHumanLong(task.createdAt)
	];
	if (task.isClosed) {
		tips.push('Закрыта: '+TimeHelper.strDateTimeHumanLong(task.closedDate))
		date=task.closedDateStr;
	} else {
		tips.push('Крайний срок: '+TimeHelper.strDateTimeHumanLong(task.deadline))
		date=task.deadlineStr;
	}

	return (<span className="deadline" title={tips.join("\n")}>{date}</span>);
});


function TaskPriority(props) {
	let rendered='';
	switch (props.priority) {
		case 0: rendered=(<span className="lowPriority">Низк.</span>); break
		case 1: rendered = (<span className="midPriority">Средн.</span>); break
		case 2: rendered = (<span className="hiPriority">Выс.</span>); break
		default: rendered = ''; break
	}
	return (<span className="priority">{rendered}</span>);
}


const TaskCard = observer((props)=>{
	//trace();
	const ref = useRef(null);
	const context=useContext(StoreContext);
	const task = get(context.items['task'].items,props.task.id);
	//console.log(context);
	const items = context.items;
	const layout = context.layout;
	const cell = props.cell;
	const index = props.index;
	const [closestEdge, setClosestEdge] = useState(null);

	const visible=layout.accomplicesVisible || task.user===cell.user;
	//console.log(ref.current);
	useEffect(()=>
	{	//описание для DND
		const dropData = {
			type: 'item',		//тип - элемент списка
			element: ref.current,//ссылка на отрисованный элемент
			item: task,			//dashItem элемент (task|job|ticket|plan)
			index: index,		//порядок элемента в списке
			cell: cell,			//ячейка в которой и список и элемент
		};
			if (visible) return dashItemDragLogic(dropData,ref,setClosestEdge)
	}
	, [ref,visible,cell,index,task]);

	if (visible) return( <li 
			className={classNames(
				'userItem',		//это понятно
				'userTask',		//это тоже
				{'dragging':task.isDragging},
				{'updating':task.isUpdating},
				{ 'alert': task.isAlert },
				{ 'flash': task.isFlash },
				{'dimmedOut':task.user!==cell.user},	//не своя задача (помогает)
				{'hovered':task.isHovered},
				{'parentTask':task.isHoveredParent},
				{'childTask': task.isHoveredChild },
				{'favorite':task.favorite},		//избранное
				{'activeNow':task.status===3},	//в работе
				{'closed':task.isClosed},		//признак что закрыта
				{'closeMe':task.status===4}		//признак что требует закрытия (подтверждения)
			)}

			onMouseEnter={()=>task.mouseIn()}
			onMouseLeave={()=>task.mouseOut()}
			ref={ref}
			id={task.uid}
		>
			<div className="content"
			><Element name={task.uid}>
				{task.isNew?
				<EditItem item={task} items={context.items.tasks}/>
				:
				<>
					<ModalLink item={task} />
					<span className="userTaskFooter">
						<TaskDeadline task={task} />
						<TaskPriority priority={task.priority} />
						<TaskStatus task={task} />
					</span>
				</>						
				}
			</Element></div>
			{closestEdge && <DropIndicator edge={closestEdge} gap="4px" background="lime"/>}
		</li>);
})

export default TaskCard;