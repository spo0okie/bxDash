import React, {useRef,useEffect,useState,useContext} from "react";
import {observer} from "mobx-react";
import {get,trace} from "mobx"
import { Tooltip } from 'antd';
import './Task.css'
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";

const TaskLink = observer((props)=>{
	//trace();
	const scrollDuration=800;
	const context=useContext(StoreContext);
	const task = get(context.items['task'].items,props.id);
	const onClick=(e)=>{
		//window.location.href=("#"+task.uid);
		context.layout.scrollTo(task.uid,scrollDuration);
		task.flashItem(400+scrollDuration);
		e.stopPropagation();
	}
	//console.log(props);

	if (task===undefined) {
		//console.log('Task #'+props.id+' not found');
		return (<Tooltip title={'Задача '+props.id+' не загружена (скорее всего закрыта до '+TimeHelper.strDateHumanLong(context.time.firstWeekStart())+')'}>
			{'Задача '+props.id}
			</Tooltip>);
	}
	return (
	<Tooltip title={'Задача '+props.id+': '+task.title}>
		<span 
			className={classNames(
				'clickable',
				'userItem',		//это понятно
				'userTaskLink',		//это тоже
				{'hovered':task.isHovered},
				{'activeNow':task.status===3},	//в работе
				{'closed':task.isClosed},		//признак что закрыта
				{'closeMe':task.status===4}		//признак что требует закрытия (подтверждения)
			)}
			
			onClick={onClick}
			
		>{props.id}</span>
	</Tooltip>);
})

export default TaskLink;