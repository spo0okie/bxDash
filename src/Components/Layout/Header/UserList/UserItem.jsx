import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { get } from 'mobx';
import { StoreContext } from "Data/Stores/StoreProvider";
import './UserItem.css';
import classNames from "classnames";
import { userAbsentsStatus } from "Helpers/IntervalHelper";
import { Tooltip } from 'antd';
import { attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { draggable,	dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import UserAlerts from "./UserAlerts";

const PhoneItem = observer(({ user }) => (
	<>
		{user.phone}
		<span className={classNames('phoneStatus', user.phoneStatus)}></span>
	</>
));

/** Ячейка пользователя в шапке со статусами и переходом на его доску. */
const UserItem = observer((props)=>{
	const context = useContext(StoreContext);
	const users = context.users;
	const id = props.id;
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

	// Повторный клик по выбранному пользователю возвращает общую доску.
	const toggleUser = useCallback(() => {
		users.setSelect(users.selected === id ? null : id);
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
		const element = ref.current;
		const dropData = { type: 'user', id };
		return combine(
			draggable({
				element,
				getInitialData: () => dropData,
				canDrag: () => users.selected === null && user.isDraggable(),
				onDragStart: () => {
					users.setHover(null);
					user.setDragging(true);
				},
				onDrop: ({ source, location }) => {
					// Сбрасываем состояние и при отмене, когда цели у сброса нет.
					user.setDragging(false);
					const target = location.current.dropTargets[0]?.data;
					if (target?.type === 'user') users.moveUser(source.data.id, target.id, extractClosestEdge(target));
				},
			}),

			dropTargetForElements({
				element,
				canDrop({ source }) {
					return users.selected === null && user.isDraggable() && source.data.type === 'user' && source.data.id !== id;
				},
				getData({ input, element }) {
					return attachClosestEdge(dropData, {
						element,
						input,
						allowedEdges: ['left', 'right'],
					});
				},
				onDrag({ self }) {
					setClosestEdge(extractClosestEdge(self.data));
				},
				onDragLeave() {
					setClosestEdge(null);
				},
				onDrop() {
					setClosestEdge(null);
				},
			}),
		);
	}, [id, user, users]);

	return (
			<td
				ref={ref}
				key={'userCard/'+id}
				title={title}
				style={{ width: 98/users.order.length+'%' }}
				className={classNames(
					'UserItem',
					'clickable',
					{'selected': id === users.selected },
					{'hovered': (id===users.hovered && !users.selected) || (id === users.selected)},
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
