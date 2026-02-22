import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { get, values } from 'mobx';
import { StoreContext } from "Data/Stores/StoreProvider";
import './UserItem.css';
import classNames from "classnames";
import { userAbsentsStatus } from "Helpers/IntervalHelper";
import { Tooltip } from 'antd';
import { attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { draggable,	dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { dashUserNewPos } from "Helpers/DndHelper";
import UserAlerts from "./UserAlerts";

const PhoneItem = observer(({ user }) => (
	<>
		{user.phone}
		<span className={classNames('phoneStatus', user.phoneStatus)}></span>
	</>
));

const UserItem = observer((props)=>{
	const context = useContext(StoreContext);
	const users = context.users;
	const id = props.id;
	const index = props.index;
	const user = get(users.items,id);
	const status = userAbsentsStatus(context.items['absent'],id);
	const ref = useRef(null);
	const [closestEdge, setClosestEdge] = useState(null);

	// Обработчики событий с useCallback для оптимизации
	const mouseIn = useCallback(() => {
		context.users.setHover(id);
	}, [id, context.users]);

	const mouseOut = useCallback(() => {
		context.users.setHover(null);
	}, [context.users]);

	const toggleUser = useCallback(() => {
		if (users.selected === null) {
			users.setSelect(id);
		} else {
			users.setSelect(null);
		}
	}, [id, users]);
	
	let title=null;
	let absentClass=null;

	if (status.days<Infinity) {
		title=status.title;
		if (status.days<=14) {
			if (!status.days) {
				absentClass='ABSENT';
			} else if (status.days<7) {
				absentClass='WEEK_ABSENT';
			} else if (status.days<14) {
				absentClass = 'TWO_WEEK_ABSENT';
			}
		}
	}

	useEffect(()=>{
		const dropData = {
			type: 'user',		//тип - элемент списка
			element: ref.current,//ссылка на отрисованный элемент
			item: user,			//dashItem элемент (task|job|ticket|plan)
			index: index,		//порядок элемента в списке
			//cell: cell,			//ячейка в которой и список и элемент
		};		
		return combine(
			//для того чтобы элемент можно было таскать
		draggable({
				element: ref.current,
				getInitialData: () => dropData,
				canDrag: () => users.selected===null && user.isDraggable(),   //не все можно переносить
				onDragStart: () => {
					console.log('drag start');
					users.setHover(null);
					user.setDragging(true);        //говорим что потащили элемент (старое место должно стать полупрозрачным)
				},
				onDragStop: () => {
					console.log('drag stop');
					user.setDragging(false);       //говорим что закончили тащить элемент
				},
				onDrop: ({source,location}) => {
					console.log('drag complete');
					console.log(source);
					console.log(location);
					//user.setDragging(false);       //говорим что закончили тащить элемент
					const edge=extractClosestEdge(location.current.dropTargets[0].data);
					users.setOrder(dashUserNewPos(
						values(users.order),
						source.data.index,
						location.current.dropTargets[0].data.index,
						edge
					));
					//dashItemsDrop(dropData.item,location);  //обрабатываем бросок
				},
			}),
				
			//для того чтобы на элемент можно было бросать другой элемент (вставка в список)
			dropTargetForElements({
				element: ref.current,
				canDrop({ source }) {
					//нельзя бросать на недвижимые элементы списка, и на самого себя (ну или можно но надо обработать как то иначе)
					return user.isDraggable() && source.data.type === 'user';
				},
				getData({ input,element }) {//когда над нами тащят элемент
					//на основании координат мыши (input) и отрендеренного элемента (element) оно добавит к dropData поле Edge - ближайшую к точке сброса грань из вариантов [top,bottom]
					//console.log(element);
					return attachClosestEdge(dropData, {
						element,
						input,
						allowedEdges: ['left','right'],
					});
				},
				onDrag({ self, source }) {
					//если над нами что-то тащат, то подсветим всю свою ячейку (для наглядности)
					//if (source.data.setCell!==undefined) source.data.setCell(dropData.cell);
	
					//если мы тащим себя над собой, то выставляем ближйшую грань как null и больше ничего не делаем
					if (source.element === dropData.element) {setClosestEdge(null); return;}
	
					//загружаем ближайшую грань, которую сохранили через getData
					const closestEdge = extractClosestEdge(self.data);
	
					//если мы тащим себя над соседними ячейками и падаем в итоге на то же место, то тоже прячем грань и выходим
					//if (samePlace(source,dropData.cell,dropData.index,closestEdge)) {setClosestEdge(null); return;}
	
					//выставляем внутреннее значение ближайшей грани элемента (используется потом при отрисовке)
					setClosestEdge(closestEdge);
				},
				onDragLeave() {
					setClosestEdge(null);   //убираем подсветку грани
				},
				onDrop() {
					setClosestEdge(null);   //убираем подсветку грани
				},
			}),
		)},[user,users,index,setClosestEdge,ref]);

	//if (closestEdge) console.log(closestEdge);
	return (
			<td 
				ref={ref}
				key={'userCard/'+id}
				title={title}
				style={{ width: 98/users.order.length+'%' }}
				className={classNames(
					'UserItem',
					'clickable',
					{'hovered':id===users.hovered && !users.selected},
					absentClass
				)}
				onMouseOver={mouseIn}
				onMouseOut={mouseOut}
				onClick={toggleUser}
				>
				<div className="firstLine">
					<span className={classNames('userStatus', user.activityStatus)}></span>
					{user.id===users.dutyTicketer && (
						<Tooltip title="Дежурный по заявкам на портале">🎫</Tooltip>
					)}
					<Tooltip title={title}>
						<span className="userName">{user.name}</span>
					</Tooltip>
					{user.phone===users.dutyPhone ? (
						<>(<Tooltip title="Дежурный на телефоне"><span className="dutyPhone"><PhoneItem user={user} /></span></Tooltip>)</>
					) : (
						<>(<PhoneItem user={user} />)</>
					)}
				</div>
				<UserAlerts username={user.name} />
				{closestEdge && <DropIndicator edge={closestEdge} />}
			</td>
	)    
})


export default UserItem;
