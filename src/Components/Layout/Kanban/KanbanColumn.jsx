import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { useStores } from "Data/Stores/StoreProvider";
import CardsBlock from "Components/Layout/Interval/Period/Data/UserCell/CardsBlock";
import notify from "Helpers/Notify";
import { dropEdge } from "Helpers/StageStacks";
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
 * Сам столбец тоже перетаскивается — за название (свёрнутый — за всю полоску). Тип данных
 * перетаскивания 'stage', у карточек — 'item', поэтому цели друг другу не мешают.
 * Куда встанет столбец, решает край цели (dropEdge): слева / справа — отдельной стопкой,
 * сверху / снизу — в ту же стопку.
 *
 * @param {Object}  props.stage    обычная или системная колонка
 * @param {number}  props.owner    владелец доски
 * @param {Array}   props.items    элементы столбца, уже отсортированные
 * @param {boolean} props.inStack  столбец делит стопку с другими (свёрнутый рисуется строкой)
 * @param {number}  props.weight   доля высоты в стопке (flex-grow)
 */
const KanbanColumn = observer(({ stage, owner, items, inStack = false, weight = 1 }) => {
	const { layout, stages } = useStores();
	const ref = useRef(null);
	const [dragOver, setDragOver] = useState(false);	// над столбцом тащат карточку
	const [dragging, setDragging] = useState(false);	// тащат сам столбец
	const [edge, setEdge] = useState(null);				// к какому краю встанет другой столбец

	const key = stage.id;
	const readOnly = Boolean(stage.system);
	const closed = stage.system && stage.key === 'closed';
	const collapsed = layout.isKanbanCollapsed(key);
	const title = stage.title;
	const toggle = useCallback(() => layout.toggleKanbanCollapsed(key), [layout, key]);
	const removeSystem = useCallback(() => layout.setKanbanSystemColumn(owner, key, false), [layout, owner, key]);

	const maxSorting = items.length ? items[0].sorting : null;
	const minSorting = items.length ? items[items.length - 1].sorting : null;

	const cell = useMemo(() => ({
		id: 'kanban/' + key,
		kanban: true,
		readOnly, //системные списки нельзя менять переносом или пересортировкой
		user: owner,
		stage: readOnly ? null : stage,
		t: null,
		dropT: null,
		maxSorting: maxSorting,
		minSorting: minSorting,
		dragOver: setDragOver,
	}), [key, owner, stage, readOnly, maxSorting, minSorting]);

	const stageId = stage?.id ?? null;

	useEffect(() => {
		const element = ref.current;
		if (!element || stageId === null) return undefined;
		// развёрнутый столбец берут за название, свёрнутый — за всю полоску
		const handle = collapsed ? element : element.querySelector('.kanbanTitleGrip');
		if (!handle) return undefined;

		return combine(
			draggable({
				element: element,
				dragHandle: handle,
				getInitialData: () => ({ type: 'stage', stageId: stageId }),
				// пока название редактируется, перетаскивание ломало бы выделение текста в поле
				canDrag: () => !element.querySelector('.kanbanTitleInput'),
				onDragStart: () => setDragging(true),
				onDrop: ({ location }) => {
					setDragging(false);
					try {
						const target = location.current.dropTargets.find(t => t.data.type === 'stageColumn');
						if (target && target.data.edge) stages.dropColumn(owner, stageId, target.data.stageId, target.data.edge);
					} catch (error) {
						// исключения из onDrop библиотека глотает молча — выводим явно
						console.error(error);
						notify.error(notify.describe(error), { title: 'Столбец не перенесён' });
					}
				},
			}),
			dropTargetForElements({
				element: element,
				canDrop: ({ source }) => source.data.type === 'stage' && source.data.stageId !== stageId,
				getData: ({ input }) => ({
					type: 'stageColumn',
					stageId: stageId,
					edge: dropEdge(element.getBoundingClientRect(), input.clientX, input.clientY),
				}),
				onDrag: ({ self }) => setEdge(self.data.edge),
				onDragLeave: () => setEdge(null),
				onDrop: () => setEdge(null),
			}),
		);
	}, [owner, collapsed, stageId, stages]);

	const style = useMemo(() => {
		// цвет столбца красит заголовок и рамку; без цвета CSS берёт цвета текущей недели календаря
		const colors = stage?.color
			? { '--kanban-color': stage.color, '--kanban-color-text': contrastText(stage.color) }
			: {};
		// в стопке развёрнутые столбцы делят высоту по весам; свёрнутый занимает одну строку
		// вес умножаем на 100: при сумме flex-grow меньше 1 столбцы заняли бы только часть высоты стопки
		// (так бывает, когда сосед свёрнут, а у оставшегося вес меньше единицы)
		const flex = inStack && !collapsed ? { flexGrow: Math.max(weight, 0.01) * 100 } : {};
		return { ...colors, ...flex };
	}, [stage?.color, inStack, collapsed, weight]);

	const indicator = edge && <DropIndicator edge={edge} gap="0px" />;

	if (collapsed) {
		return (
			<div
				ref={ref}
				className={classNames("kanbanColumn", "collapsed", { closed, row: inStack, dragging })}
				style={style}
				data-stage-id={stageId}
				onClick={toggle}
				title={'Развернуть «' + title + '»'}
			>
				<span className="kanbanCount">{items.length}</span>
				<h3>{title}</h3>
				{indicator}
			</div>
		);
	}

	return (
		<div
			ref={ref}
			className={classNames("kanbanColumn", { closed, draggedOver: dragOver, dragging })}
			style={style}
			data-stage-id={stageId}
		>
			<KanbanColumnTitle stage={stage} title={title} count={items.length} onToggle={toggle} onRemove={readOnly ? removeSystem : undefined} />
			<div className="kanbanColumnBody userCellContent">
				{!readOnly && <KanbanCreateButton cell={cell} />}
				<CardsBlock items={items} cell={cell} dnd={!readOnly} />
			</div>
			{indicator}
		</div>
	);
});

export default KanbanColumn;
