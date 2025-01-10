import React, {useContext} from "react";
import {observer} from "mobx-react";
import {get,trace} from "mobx"

import './TicketCard.css'
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";

const TicketLink = observer((props)=>{
	//trace();
	const scrollDuration=800;
	const context=useContext(StoreContext);
	const item = get(context.items['ticket'].items,props.id);
	const onClick=(e)=>{
		//window.location.href=("#"+task.uid);
		context.layout.scrollTo(item.uid,scrollDuration);
		item.flashItem(400+scrollDuration);
		e.stopPropagation();
	}
	//console.log(props);

	if (item===undefined) {
		console.log('Task #'+props.id+' not found');
		return 'Задача '+props.id;
	}
	return <span 
		className={classNames(
			'clickable',
			'userItem',		//это понятно
			'userTicketLink',		//это тоже
			{'hovered':item.isHovered},
			{ 'closed': item.isClosed && item.status !== 'blue' },		//признак что закрыта
			{ 'green': !item.isClosed && item.status==='green'},		//зеленый
			{ 'red': !item.isClosed && item.status === 'red' },			//красный
			{ 'blue': item.status === 'blue' },							//красный
		)}
		onClick={onClick}
		title={item.title}
		
	>{props.id}</span>
})

export default TicketLink;