import React, { useCallback } from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import KanbanColumn from "./KanbanColumn";
import KanbanAddColumn from "./KanbanAddColumn";

import "./Kanban.css";

const NO_ITEMS = Object.freeze([]);

/**
 * Канбан-раскладка персональной доски (раскладка E, см. docs/layouts.md и plans/bucket_columns.md).
 *
 * Вместо оси времени — столбцы владельца доски (выбранного пользователя). На доске все его
 * открытые задачи, работы и заявки независимо от даты; завершённые — отдельным системным
 * столбцом справа, в пределах загруженной истории.
 *
 * Сам ничего не фильтрует: раскладку по столбцам одним проходом считает stages.board.
 */
const KanbanBoard = observer(() => {
	const { stages } = useStores();
	const owner = stages.owner;
	const columns = stages.stagesOf(owner);
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
			{columns.map(stage => (
				<KanbanColumn
					key={stage.id}
					stage={stage}
					owner={owner}
					items={board.byStage.get(stage.id) ?? NO_ITEMS}
				/>
			))}
			<KanbanColumn key="closed" closed owner={owner} items={board.closed} />
			<KanbanAddColumn owner={owner} />
		</div>
	);
});

export default KanbanBoard;
