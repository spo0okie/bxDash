import React, {useContext} from "react";
import {observer} from "mobx-react";
import {get,trace} from "mobx"
import { Tooltip } from 'antd';

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
		//console.log('Task #'+props.id+' not found');
		return 'Заявка '+props.id;
	}
	return (
		<Tooltip title={'Заявка '+props.id+': '+item.title}>
			<span 
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
			>
				{props.id}
			</span>
		</Tooltip>
	)
})

export default TicketLink;