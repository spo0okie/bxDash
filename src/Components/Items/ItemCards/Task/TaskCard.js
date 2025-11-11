import React, {useRef,useEffect,useState,useContext} from "react";
import {observer} from "mobx-react";
import { dashItemDragLogic } from "Helpers/DndHelper";
import {get,trace,values} from "mobx"
import { Element} from 'react-scroll';

import './Task.css'
import classNames from "classnames";
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import EditItem from "../../EditItem/EditItem";
import ModalLink from "Components/Layout/Modal/ModalLink";
import { Dropdown, Tooltip } from "antd";


const TaskStatusUpdates=observer((props)=>{
	//trace();
	const context=useContext(StoreContext);
	const task = get(context.items['task'].items,props.task.id);
	if (!task.updatesCount) return '';
	return(<a href={task.viewUrl+'#updates'} className="task-item-updates" title={'Изменения ('+task.updatesCount+')'}>
		{task.updatesCount}
	</a>);
})


const TaskStatus=observer((props)=>{
	const context=useContext(StoreContext);
	const task = get(context.items['task'].items,props.task.id);
	let onclick=null;
	switch (task.status) {
		case 1:     onclick=()=>task.changeStatus(3); break;
		case 2:     onclick=()=>task.changeStatus(3); break;
		case 3:     onclick=()=>task.changeStatus(2); break;
		default:	onclick=null;
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
	const context=useContext(StoreContext);
	const task = get(context.items['task'].items,props.task.id);

	let date='неизв';
	let tips=[
		'Создана: '+TimeHelper.strDateTimeHumanLong(task.createdAt)
	];
	if (task.isClosed) {
		tips.push('Закрыта: '+TimeHelper.strDateTimeHumanLong(task.closedDate))
		date=task.closedDateStr;
	} else {
		tips.push('Крайний срок: '+(task.deadline?TimeHelper.strDateTimeHumanLong(task.deadline):'отсутствует'))
		date=task.deadlineStr;
	}

	return (<Tooltip title={tips.join("\n")}><span className="deadline" >{date}</span></Tooltip>);
});


function TaskPriority(props) {
	switch (props.priority) {
		case 0: return (<span className="priority"><Tooltip title={'Низкий приоритет'}><span className="taskPriority low"/></Tooltip></span>);
		case 1: return  (<span className="priority"><Tooltip title={'Средний приоритет'}><span className="taskPriority mid"/></Tooltip></span>);
		case 2: return  (<span className="priority"><Tooltip title={'Высокий приоритет'}><span className="taskPriority high"/></Tooltip></span>);
		default: return null;
	}	
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

	

	const contextMenuClick=(e)=>{
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

			default: console.log('unknown menu item');
		}
	}

	if (visible) return( 
	<Dropdown menu={{ items:items.contextMenu(task),onClick:items.contextMenuHandler(task,cell) }} trigger={['contextMenu']}>
		<li 
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
				{'negative':task.mark===-1},	//негативная оценка
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
		</li>
	</Dropdown>
	);
})

export default TaskCard;