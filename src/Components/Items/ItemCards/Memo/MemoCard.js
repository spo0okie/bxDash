import React, {useRef,useEffect,useState,useContext} from "react";
import {observer} from "mobx-react";
import { dashItemDragLogic } from "Helpers/DndHelper";
import { get, trace } from "mobx"
import remarkGfm from "remark-gfm";

import './MemoCard.css'
import classNames from "classnames";
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { StoreContext } from "Data/Stores/StoreProvider";
import EditItem from "../../EditItem/EditItem";
import Markdown from 'react-markdown'
import TaskLink from "../Task/TaskLink";
import TimeHelper from "Helpers/TimeHelper";
import { visit} from "unist-util-visit";
import { Dropdown } from "antd";


const MemoCard = observer((props)=>{
	//trace();
	const ref = useRef(null);
	const context=useContext(StoreContext);
	const item = get(context.items['memo'].items,props.item.id);
	const cell = props.cell;
	const index = props.index;
	const [closestEdge, setClosestEdge] = useState(null);

	//console.log('memo');

	//описание для DND
	//const dropData = ;
	const isEdit=item.isEdit;

	useEffect(()=>{
		//console.log('dnd');
		if (!isEdit) return dashItemDragLogic({
			type: 'item',		//тип - элемент списка
			element: ref.current,//ссылка на отрисованный элемент
			item: item,			//dashItem элемент (task|job|ticket|plan)
			index: index,		//порядок элемента в списке
			cell: cell,			//ячейка в которой и список и элемент
		},ref,setClosestEdge)
	},[ref,item,cell,index,isEdit]);/** */

	const onToggleClick=(e)=>{
		item.setExpanded(!item.isExpanded);
		e.stopPropagation();
		e.preventDefault();
	}

	//заменяем специальные ссылки вида TaskLink(id) на элементы <tasklink />
	const remarkTasks = () => {
		return (tree) => {
			visit(tree, { tagName: "a" }, (node) => {
				if (!node?.properties) node.properties = {}
				if (node.children.length && node.children[0].type === 'text' && node.children[0].value === 'TaskLink') {
					node.children[0].value = node.properties.href;
					node.tagName = 'tasklink';
					node.properties.taskId = Number(node.properties.href)
					//node=<TaskLink id={19033} />
				}
				//console.log(node);
			});
		};
	};

	const menuItems= [
		{
			label: 'Выполнено',
			key: 'complete',
		},
		{
			label: 'В работе',
			key: 'uncomplete',
		}
	];

	const contextMenuClick=(e)=>{
		console.log(e);
		switch(e.key) {
			case 'complete': item.update({ closedDate: Math.round(TimeHelper.getTimestamp()) }, true); break;
			case 'uncomplete': item.update({ closedDate: null }, true); break;
			default: console.log('unknown menu item');
		}
		e.domEvent.preventDefault();
		e.domEvent.stopPropagation();
	}

	let title = item.title;
	if (item.isExpanded) {
		title = item.parsedTitle;
		//console.log(title);
		title = <Markdown 
			skipHtml={true} 
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[remarkTasks]}
			components={{
				tasklink: (props) => {return (<TaskLink id={props.taskId}/>); }
			}}
		>{title.replace("\n","  \n")}</Markdown>;

	}

	return( <li 
		className={classNames(
			'userItem',		//это понятно
			'userMemo',		//это тоже
			{'dragging':item.isDragging},
			{'updating':item.isUpdating},
			{'alert':item.isAlert},
			{'hovered':item.isHovered},
			{'parentTask':item.isHoveredParent},
			/*{'childTask':item.parent!==null && item.parent.isHovered},*/
			{'favorite':item.favorite},		//избранное
			//{'activeNow':task.status===3},	//в работе
			{'closed':item.isClosed},		//признак что закрыта
			{'open':item.isOpen},		//признак что закрыта
			{ 'expanded': item.isExpanded },
			{ 'compact': !item.isExpanded },
		)}

		onMouseEnter={()=>item.mouseIn()}
		onMouseLeave={()=>item.mouseOut()}
		onClick={() => { item.startEdit() }}
		ref={ref}
		//title={String(item.t)}

	>
		<Dropdown menu={{ items:menuItems, onClick:contextMenuClick }} trigger={['contextMenu']}>
		<div className="content">
			{item.isEdit?
				<EditItem item={item}/>
			:
			<>
				<span className="memoToggle" onClick={onToggleClick}></span>
				<span className="task-title-link clickable" >{title}</span>
			</>						
			}
		</div>
		</Dropdown>
		{closestEdge && <DropIndicator edge={closestEdge} gap="4px" background="lime"/>}
	</li>);
})

export default MemoCard;