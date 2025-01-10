import React, { useState } from "react";
import './CreateItemButton.css';
import TaskItem from "Data/Items/TaskItem";
import JobItem from "Data/Items/JobItem";
import PlanItem from "Data/Items/PlanItem";
import { StoreContext } from "Data/Stores/StoreProvider";
import {get } from 'mobx';
import ModalLink from "Components/Layout/Modal/ModalLink";

const CreateTaskButton=(props)=>{
	const [label, setLabel] = useState('здч');
	const onHover = () => { setLabel('задача') }
	const onLeave = () => { setLabel('здч') }
	const onClick=()=>{
		const items = props.context.items['task']
		//console.log('new task');
		//console.log(props.cell);
		const item=new TaskItem({
			id: items.getMaxId()+64,
			user:props.cell.user,
			deadline: props.cell.dropT,
			isNew:true,
			isEdit:true,
			sorting:props.cell.maxSorting?props.cell.maxSorting+20:null,
		}, {}, items);
		//console.log(task);
		items.setItem(item);
	}
	return <span className="create task" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreateTicketButton=(props)=>{
	const [label,setLabel]=useState('звк');
	const onHover = () => { setLabel('заявка') }
	const onLeave = () => { setLabel('звк') }

	return (<span className="create ticket" onMouseEnter={onHover} onMouseLeave={onLeave}>
		<ModalLink link={'/bitrix/admin/ticket_edit.php?RESPONSIBLE_USER_ID=' + props.cell.user } >{label}</ModalLink>
	</span>);
}

const CreateJobButton=(props)=>{
	const [label, setLabel] = useState('раб');
	const onHover = () => { setLabel('работа') }
	const onLeave = () => { setLabel('раб') }
	const onClick = () => {
		const items = props.context.items['job']
		//console.log('new task');
		//console.log(props.cell);
		const item = new JobItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,
			deadline: props.cell.dropT,
			isNew: true,
			isEdit: true,
			sorting: props.cell.maxSorting ? props.cell.maxSorting + 20 : null,
		}, {}, items);
		//console.log(job);
		items.setItem(item);
	}
	return <span className="create job" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreateClosedJobButton = (props) => {
	const [label, setLabel] = useState('гот');
	const onHover = () => { setLabel('готово') }
	const onLeave = () => { setLabel('гот') }
	const onClick = () => {
		const items = props.context.items['job']
		//console.log('new task');
		//console.log(props.cell);
		const item = new JobItem({
			id: items.getMaxId() + 64,
			user: props.cell.user,
			closedDate: props.cell.dropT,
			isNew: true,
			isEdit: true,
			sorting: props.cell.maxSorting ? props.cell.maxSorting + 20 : null,
		}, {}, items);
		//console.log(job);
		items.setItem(item);
	}
	return <span className="create closedJob" onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}>{label}</span>
}

const CreatePlanButton = (props) => {
	const onClick = () => {
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
	}
	return <span className="create plan" onClick={onClick}>план</span>
}


class CreateItemButton extends React.Component {

    render() {
        const cell = this.props.cell;
		const period = get(this.context.periods.periods,cell.t);
		const closed = period.isClosed;
		const open = period.isOpen;

        return (
			<span className="CreateItemButton">
				{closed && <CreateClosedJobButton items={this.context.items} cell={cell} context={this.context} />}
				{open && <CreateJobButton items={this.context.items} cell={cell} context={this.context} />}
				{open && this.props.cell.isToday && <CreateTicketButton items={this.context.items} cell={cell} context={this.context} />}
				{open && <CreateTaskButton items={this.context.items} cell={cell} context={this.context} />}
				{this.props.cell.dropT !== null && this.props.cell.period.wDays.includes(6) && <CreatePlanButton items={this.context.items} cell={cell} context={this.context} />}
			</span>
	
        )
    }
}
CreateItemButton.contextType=StoreContext
export default CreateItemButton;