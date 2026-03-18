import React, { useContext, useState, useCallback } from "react";
import './CreateItemButton.css';
import TaskItem from "Data/Items/TaskItem";
import JobItem from "Data/Items/JobItem";
import PlanItem from "Data/Items/PlanItem";
import TicketItem from "Data/Items/TicketItem";
import { StoreContext } from "Data/Stores/StoreProvider";
import {get } from 'mobx';
import { observer } from "mobx-react";
import TimeHelper from "Helpers/TimeHelper";
import CreateTicketModal from "Components/Items/CreateTicketModal/CreateTicketModal";

const CreateTaskButton=(props)=>{
	const [label, setLabel] = useState('здч');
	// Обработчики с useCallback для предотвращения лишних ре-рендеров
	const onHover = useCallback(() => { setLabel('задача') }, []);
	const onLeave = useCallback(() => { setLabel('здч') }, []);
	const onClick = useCallback(() => {
		const items = props.context.items['task']
		//console.log('new task');
		//console.log(props.cell);
		const priority = props.cell.priority;
		const priorityData = priority !== null && priority !== undefined ? { priority } : {};
		const item=new TaskItem({
			id: items.getMaxId()+64,
			user:props.cell.user,
			deadline: props.cell.dropT,
			isNew:true,
			isEdit:true,
			sorting:props.cell.maxSorting?props.cell.maxSorting+20:null,
			...priorityData,
		}, {}, items);
		//console.log(task);
		items.setItem(item);
	}, [props.context.items, props.cell]);
	return <span className="create task" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreateTicketButton=(props)=>{
	const [label,setLabel]=useState('звк');
	// Обработчики с useCallback для предотвращения лишних ре-рендеров
	const onHover = useCallback(() => { setLabel('заявка') }, []);
	const onLeave = useCallback(() => { setLabel('звк') }, []);
	
	const onClick = useCallback(() => {
		const items = props.context.items['ticket'];
		const priority = props.cell.priority;
		const priorityData = priority !== null && priority !== undefined ? { priority } : {};
		// Создаем новый тикет как и другие элементы
		const item = new TicketItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,  // ответственный = пользователь блока
			isNew: true,
			isEdit: true,
			...priorityData,
		}, {}, items);
		items.setItem(item);
		props.context.layout.setTicketModalVisible(true);
	}, [props.context.items, props.cell.user, props.context.layout]);

	return (
		<span 
			className="create ticket" 
			onClick={onClick}
			onMouseEnter={onHover} 
			onMouseLeave={onLeave}
		>
			{label}
		</span>
	);
}

const CreateJobButton=(props)=>{
	const [label, setLabel] = useState('раб');
	// Обработчики с useCallback для предотвращения лишних ре-рендеров
	const onHover = useCallback(() => { setLabel('работа') }, []);
	const onLeave = useCallback(() => { setLabel('раб') }, []);
	const onClick = useCallback(() => {
		const items = props.context.items['job']
		const priority = props.cell.priority;
		const priorityData = priority !== null && priority !== undefined ? { priority } : {};
		//console.log('new task');
		//console.log(props.cell);
		const item = new JobItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,
			deadline: props.period.isToday?		//если работа на сегодня, 
				TimeHelper.getTimestamp():		//то ставим ее на текущее время
				props.cell.dropT,				//иначе на время ячейки
			isNew: true,
			isEdit: true,
			sorting: props.cell.maxSorting ? props.cell.maxSorting + 20 : null,
			...priorityData,
		}, {}, items);
		//console.log(job);
		items.setItem(item);
	}, [props.context.items, props.cell.user, props.cell.dropT, props.cell.maxSorting, props.period.isToday]);
	return <span className="create job" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreateClosedJobButton = (props) => {
	const [label, setLabel] = useState('гот');
	// Обработчики с useCallback для предотвращения лишних ре-рендеров
	const onHover = useCallback(() => { setLabel('готово') }, []);
	const onLeave = useCallback(() => { setLabel('гот') }, []);
	const onClick = useCallback(() => {
		const items = props.context.items['job']
		const priority = props.cell.priority;
		const priorityData = priority !== null && priority !== undefined ? { priority } : {};
		//console.log('new task');
		//console.log(props.cell);
		const item = new JobItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,
			closedDate: props.period.isToday?	//если работа на сегодня, 
				TimeHelper.getTimestamp():		//то ставим ее на текущее время
				props.cell.dropT,				//иначе на время ячейки
			isNew: true,
			isEdit: true,
			sorting: props.cell.maxSorting ? props.cell.maxSorting + 20 : null,
			...priorityData,
		}, {}, items);
		//console.log(job);
		items.setItem(item);
	}, [props.context.items, props.cell.user, props.cell.dropT, props.cell.maxSorting, props.period.isToday]);
	return <span className="create closedJob" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreatePlanButton = (props) => {
	// Обработчик с useCallback для предотвращения лишних ре-рендеров
	const onClick = useCallback(() => {
		const items = props.context.items['plan']
		//console.log('new task');
		//console.log(props.cell);
		const item = new PlanItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,
			deadline: props.cell.period.end - 3600*6*1000,
			isNew: true,
			isEdit: true,
			sorting: props.cell.maxSorting ? props.cell.maxSorting + 20 : null,
		}, {}, items);
		//console.log(job);
		items.setItem(item);
	}, [props.context.items, props.cell.user, props.cell.period.end, props.cell.maxSorting]);
	return <span className="create plan" onClick={onClick}>план</span>
}


const CreateItemButton = observer((props)=>{
	const context = useContext(StoreContext);
	const showJobs = context.layout.jobsVisible;
	const cell = props.cell;
	const period = get(context.periods.periods,cell.t);
	const closed = period.isClosed;
	const open = period.isOpen;
	const isToday = period.isToday;
	//console.log(this.context);

	return (
		<span className="CreateItemButton">
			{closed && showJobs		&& <CreateClosedJobButton	items={context.items} cell={cell} context={context} period={period} />}
			{open && showJobs		&& <CreateJobButton			items={context.items} cell={cell} context={context} period={period} />}
			{open && isToday		&& <CreateTicketButton		items={context.items} cell={cell} context={context} />}
			{open 					&& <CreateTaskButton		items={context.items} cell={cell} context={context} />}
			{period.dropTime !== null && period.wDays.includes(6) && <CreatePlanButton items={context.items} cell={cell} context={context} />}
		</span>

	)
})

export default CreateItemButton;
