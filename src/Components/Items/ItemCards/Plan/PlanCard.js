import React, {useRef,useContext} from "react";
import {observer} from "mobx-react";
import { get, trace } from "mobx"
import { Dropdown } from 'antd';

import './PlanCard.css'
import classNames from "classnames";
import { StoreContext } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import EditItem from "../../EditItem/EditItem";
import TaskLink from "../Task/TaskLink";


const PlanCard = observer((props)=>{
	//trace();
	const ref = useRef(null);
	const context=useContext(StoreContext);
	const item = get(context.items['plan'].items,props.plan.id);

	let strAuthStatus;
	switch (item.authStatus) {
		case 0: strAuthStatus='Еще не согласовано'; break;
		case 1: strAuthStatus='Согласовано'; break;
		case 2: strAuthStatus='Отказано'; break;
		default: strAuthStatus='???'
	}
	const items= [
		context.users.isAdmin()?{
			label: 'Согласование',			
			key: '1',
			type: 'group',
			children: [
				{
					label: 'Согласовать',
					key: 'approve',
				},
				{
					label: 'Отказать',
					key: 'deny',
				},
				{
					label: 'Убрать статус',
					key: 'removeAuth',
				},

			]
		}:{
			label: strAuthStatus,
			key: '1',
			disabled: true,
		},
		{
			type: 'divider',
		},
		{
			label: 'Выполнение',
			key: '2',
			type: 'group',
			children: [
				{
					label: 'Сделано',
					key: 'complete',
				},
				{
					label: 'Частично сделано',
					key: 'partial',
				},
				{
					label: 'Не сделано',
					key: 'failed',
				},

			]
		},
	];

	const contextMenuClick=(e)=>{
		console.log(e.key);
		switch(e.key) {
			case 'removeAuth': item.update({ authStatus: 0 }, true); break;
			case 'approve': item.update({ authStatus: 1 }, true); break;
			case 'deny': item.update({ authStatus: 2 }, true); break;

			case 'failed': item.update({ status: 0 }, true); break;
			case 'partial': item.update({ status: 1 }, true); break;
			case 'complete': item.update({ status: 2 }, true); break;

			default: console.log('unknown menu item');
		}
	}

	const getTitle=()=> {
		if (item.childUids.length) {
			let links=[];
			item.childUids.forEach(uid=>{
				const tokens=uid.split(':');
				//console.log(tokens);
				const type=tokens[0];
				if (type==='task') {
					const id=Number(tokens[1]);
					const task=get(context.items['task'].items,id);
					if (task!==undefined)
						links.push(<TaskLink id={id} />,': '+task.title)	
				}
			})
			if (links.length) return links;
		}
		return item.title;
	}

	return( <li 
		className={classNames(
			'userItem',		//это понятно
			'userPlan',		//это тоже
			//{'dragging':item.isDragging},
			{'updating':item.isUpdating},
			{'alert':item.isAlert},
			{'hovered':item.isHovered},
			{'parentTask':item.isHoveredParent},
			{'childTask':item.isHoveredChild},
			{'favorite':item.favorite},		//избранное			
			{'failed': item.status === 0 && TimeHelper.getTimestamp() >= item.deadline },
			{'unknown': item.status === 0 && TimeHelper.getTimestamp() < item.deadline },
			{'partial': item.status === 1 },		
			{'complete': item.status === 2 },		

			{ 'authorized': item.authStatus === 1 },
			{ 'denied': item.authStatus === 2 },		
		)}

		onMouseEnter={()=>item.mouseIn()}
		onMouseLeave={()=>item.mouseOut()}
		onClick={()=>{item.startEdit()}}

		ref={ref}
		//title={item.sorting}

	>
		<Dropdown menu={{ items,onClick:contextMenuClick }} trigger={['contextMenu']}>
		<div className="content">
			{item.isEdit && !item.authStatus?
				<EditItem item={item}/>
			:
			<>
				<span className="plan-title-link clickable">{getTitle()}</span>{item.comments?<hr/>:''}
				{item.isEdit && item.authStatus ?
					<EditItem item={item} />
					:
					<span className="plan-comments clickable">{item.comments}</span>
				}
			</>						
			}
		</div>
		</Dropdown>
	</li>);
})

export default PlanCard;