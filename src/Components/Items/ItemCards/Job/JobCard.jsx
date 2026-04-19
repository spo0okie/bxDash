import React, {useRef,useEffect,useState,useContext,useCallback} from "react";
import {observer} from "mobx-react";
import { dashItemDragLogic } from "Helpers/DndHelper";
import { get } from "mobx"


import './JobCard.css'
import classNames from "classnames";
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { StoreContext } from "Data/Stores/StoreProvider";
import EditItem from "../../EditItem/EditItem";
import ParentLink from "../../ParentLink/ParentLink";
import { Dropdown } from "antd";




const JobCard = observer((props)=>{
	//trace();
	const ref = useRef(null);
	const context=useContext(StoreContext);
	const item = get(context.items['job'].items,props.job.id);
	//console.log(context);
	const cell = props.cell;
	const index = props.index;
	const [closestEdge, setClosestEdge] = useState(null);

	// Оптимизированные обработчики событий для избежания лишних ре-рендеров
	const handleMouseEnter = useCallback(() => item.mouseIn(), [item]);
	const handleMouseLeave = useCallback(() => item.mouseOut(), [item]);
	const handleClick = useCallback(() => item.startEdit(), [item]);

	//console.log('job');

	//описание для DND
	//const dropData = ;

	const isEdit = item.isEdit;

	useEffect(()=>{
		// Если не отключить DND во время редактирования, мышью ломается выделение текста в карточке
		if (!isEdit) return dashItemDragLogic({
			type: 'item',		//тип - элемент списка
			element: ref.current,//ссылка на отрисованный элемент
			item: item,			//dashItem элемент (task|job|ticket|plan)
			index: index,		//порядок элемента в списке
			cell: cell,			//ячейка в которой и список и элемент
		},ref,setClosestEdge);
	}, [ref, item, cell, index, isEdit]);/** */

	const onToggleClick=(e)=>{
		item.completionToggle();
		e.stopPropagation();
		e.preventDefault();
	}

	return( 
	<Dropdown menu={{ items:context.items.contextMenu(item),onClick:context.items.contextMenuHandler(item,cell) }} trigger={['contextMenu']}>
	<li 
		className={classNames(
			'userItem',		//это понятно
			'userJob',		//это тоже
			{'dragging':item.isDragging},
			{'updating':item.isUpdating},
			{'alert':item.isAlert},
			{'hovered':item.isHovered},
			{'parentTask':item.isHoveredParent},
			{'childTask':item.isHoveredChild},
			{'favorite':item.favorite},		//избранное
			//{'activeNow':task.status===3},	//в работе
			{'closed':item.isClosed},		//признак что закрыта
			{'open':item.isOpen},		//признак что закрыта
		)}

		onMouseEnter={handleMouseEnter}
		onMouseLeave={handleMouseLeave}
		onClick={handleClick}
		ref={ref}
	>
		<span className="jobToggle" onClick={onToggleClick}></span>
		<div className="content">
			{item.isEdit?
				<EditItem item={item}/>
			:
			<>
				<ParentLink item={item}/> <span className="task-title-link clickable">{item.cleanTitle()}</span>

			</>						
			}
		</div>
		{closestEdge && <DropIndicator edge={closestEdge} gap="4px" background="lime"/>}
	</li>
	</Dropdown>
	);
})

export default JobCard;