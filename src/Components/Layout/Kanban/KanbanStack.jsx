import React, { useRef, useState, useCallback, Fragment } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "Data/Stores/StoreProvider";
import { resizeWeights } from "Helpers/StageStacks";
import KanbanColumn from "./KanbanColumn";

const NO_ITEMS = Object.freeze([]);

/**
 * Стопка столбцов канбана — одна вертикальная колонка доски с одним или несколькими столбцами.
 *
 * Развёрнутые столбцы делят высоту по весам (layout.kanbanHeight): пока границу не двигали,
 * у всех вес 1 — то есть поровну. Границу между соседними развёрнутыми столбцами можно
 * перетащить; веса хранятся локально в настройках, на бэк не уходят.
 * Свёрнутый столбец в стопке занимает одну строку и в делёжке высоты не участвует.
 *
 * @param {Array}  props.columns стадии стопки сверху вниз
 * @param {number} props.owner   владелец доски
 * @param {Object} props.board раскладка элементов по обычным и системным колонкам
 */
const KanbanStack = observer(({ columns, owner, board }) => {
	const { layout } = useStores();
	const ref = useRef(null);
	// веса во время перетаскивания границы; в настройки пишем один раз — когда отпустили
	const [live, setLive] = useState(null);

	const inStack = columns.length > 1;
	const isCollapsed = stage => layout.isKanbanCollapsed(stage.id);
	const weightOf = stage => live?.[stage.id] ?? layout.kanbanHeight(stage.id);

	const startResize = useCallback((event, upperId, lowerId) => {
		event.preventDefault();
		const root = ref.current;
		if (!root) return;
		// текущие высоты развёрнутых столбцов стопки — от них считаем новые веса
		const measured = Array.from(root.querySelectorAll(':scope > .kanbanColumn:not(.collapsed)')).map(element => ({
			// Системные колонки имеют строковые ключи; resizeWeights поддерживает оба типа id.
			id: columns.find(column => String(column.id) === element.getAttribute('data-stage-id')).id,
			height: element.getBoundingClientRect().height,
		}));
		const startY = event.clientY;
		let last = null;

		const onMove = (moveEvent) => {
			last = resizeWeights(measured, upperId, lowerId, moveEvent.clientY - startY);
			setLive(last);
		};
		const onUp = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			document.body.classList.remove('kanbanResizing');
			if (last) layout.setKanbanHeights(last);
			setLive(null);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		// на время перетаскивания — курсор изменения размера и без выделения текста по всей странице
		document.body.classList.add('kanbanResizing');
	}, [layout, columns]);

	// одиночный свёрнутый столбец — узкая вертикальная полоска на всю высоту
	const narrow = !inStack && isCollapsed(columns[0]);

	return (
		<div ref={ref} className={classNames("kanbanStack", { narrow, stacked: inStack })}>
			{columns.map((stage, index) => {
				const next = columns[index + 1];
				// граница двигается только между двумя развёрнутыми столбцами
				const resizable = next && !isCollapsed(stage) && !isCollapsed(next);
				return (
					<Fragment key={stage.id}>
						<KanbanColumn
							stage={stage}
							owner={owner}
							items={(stage.system ? board[stage.key] : board.byStage.get(stage.id)) ?? NO_ITEMS}
							inStack={inStack}
							weight={weightOf(stage)}
						/>
						{resizable && (
							<div
								className="kanbanResizer"
								title="Потяните, чтобы изменить высоту столбцов"
								onMouseDown={event => startResize(event, stage.id, next.id)}
							/>
						)}
					</Fragment>
				);
			})}
		</div>
	);
});

export default KanbanStack;
