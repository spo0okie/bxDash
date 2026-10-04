import React, { useMemo, useState, useCallback } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "Data/Stores/StoreProvider";
import CardsBlock from "Components/Layout/Interval/Period/Data/UserCell/CardsBlock";
import KanbanCreateButton from "./KanbanCreateButton";
import KanbanColumnTitle from "./KanbanColumnTitle";
import { contrastText } from "./kanbanColor";

/**
 * Столбец канбан-доски: заголовок (KanbanColumnTitle — название, счётчик, меню) и список карточек.
 *
 * Для карточек и drag-and-drop столбец — такая же «ячейка», как ячейка календаря,
 * только с флагом kanban: DndHelper по нему понимает, что перенос меняет столбец и порядок,
 * но не дату и не ответственного.
 *
 * @param {Object}  props.stage   стадия (нет у системного столбца «Завершённые»)
 * @param {number}  props.owner   владелец доски
 * @param {Array}   props.items   элементы столбца, уже отсортированные
 * @param {boolean} props.closed  системный столбец завершённых: без создания и перетаскивания
 */
const KanbanColumn = observer(({ stage = null, owner, items, closed = false }) => {
	const { layout } = useStores();
	const [dragOver, setDragOver] = useState(false);

	const key = closed ? 'closed' : stage.id;
	const collapsed = layout.isKanbanCollapsed(key);
	const title = closed ? 'Завершённые' : stage.title;
	const toggle = useCallback(() => layout.toggleKanbanCollapsed(key), [layout, key]);

	const maxSorting = items.length ? items[0].sorting : null;
	const minSorting = items.length ? items[items.length - 1].sorting : null;

	const cell = useMemo(() => ({
		id: 'kanban/' + key,
		kanban: true,
		user: owner,
		stage: stage,
		t: null,
		dropT: null,
		maxSorting: maxSorting,
		minSorting: minSorting,
		dragOver: setDragOver,
	}), [key, owner, stage, maxSorting, minSorting]);

	// цвет столбца красит заголовок и рамку; без цвета CSS берёт цвета текущей недели календаря
	const style = useMemo(() => (stage?.color
		? { '--kanban-color': stage.color, '--kanban-color-text': contrastText(stage.color) }
		: null), [stage?.color]);

	if (collapsed) {
		return (
			<div
				className={classNames("kanbanColumn", "collapsed", { closed })}
				style={style}
				onClick={toggle}
				title={'Развернуть «' + title + '»'}
			>
				<span className="kanbanCount">{items.length}</span>
				<h3>{title}</h3>
			</div>
		);
	}

	return (
		<div className={classNames("kanbanColumn", { closed, draggedOver: dragOver })} style={style}>
			<KanbanColumnTitle stage={stage} title={title} count={items.length} onToggle={toggle} />
			<div className="kanbanColumnBody userCellContent">
				{!closed && <KanbanCreateButton cell={cell} />}
				<CardsBlock items={items} cell={cell} dnd={!closed} />
			</div>
		</div>
	);
});

export default KanbanColumn;
