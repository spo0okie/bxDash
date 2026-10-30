import React, { useCallback } from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import KanbanStack from "./KanbanStack";
import KanbanAddColumn from "./KanbanAddColumn";

import "./Kanban.css";

/**
 * Канбан-раскладка персональной доски (раскладка E, см. docs/layouts.md и plans/bucket_columns.md).
 *
 * Вместо оси времени — столбцы владельца доски (выбранного пользователя). На доске все его
 * открытые задачи, работы и заявки независимо от даты; рядом — опциональные системные
 * списки завершённых, наблюдаемых и поставленных задач.
 *
 * Доска — ряд стопок (KanbanStack): в стопке один столбец на всю высоту или несколько друг под другом.
 * Сам ничего не фильтрует: раскладку по столбцам одним проходом считает stages.board.
 */
const KanbanBoard = observer(() => {
	const { stages } = useStores();
	const owner = stages.owner;
	const stacks = stages.columnStacksOf(owner);
	const board = stages.board;

	const reload = useCallback(() => stages.load(owner), [stages, owner]);

	if (!stages.isLoaded(owner)) {
		return (
			<div className="kanbanBoard kanbanEmpty">
				<span>Столбцы доски загружаются…</span>
				<button className="small" onClick={reload}>Повторить</button>
			</div>
		);
	}

	return (
		<div className="kanbanBoard" id="kanbanBoard">
			{stacks.map(columns => (
				// ключ — верхний столбец стопки: стопка «живёт», пока жив её верх
				<KanbanStack key={columns[0].id} columns={columns} owner={owner} board={board} />
			))}
			<KanbanAddColumn owner={owner} />
		</div>
	);
});

export default KanbanBoard;
