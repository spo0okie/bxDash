import React from 'react';
import { Modal, Radio, Space } from 'antd';
import { bxPostJson } from './BxJson';
import notify from './Notify';
import TaskLink from 'Components/Items/ItemCards/Task/TaskLink';
import { StoreContext } from 'Data/Stores/StoreProvider';

/** Сохраняет связь через Bitrix и перечитывает обе стороны для обновления подсветки. */
export async function saveTaskRelation(source, target, relation) {
	await bxPostJson(source.context.main.bx, 'task/link/' + source.id, { targetId: target.id, relation });
	// Обе стороны могут быть открыты и у других пользователей дашборда.
	[source, target].forEach(task => {
		task.reload();
		task.broadcastUpdate();
	});
}

/** Предлагает тип связи; верхняя задача — перетаскиваемая, нижняя — принимающая. */
export function chooseTaskRelation(source, target, stores) {
	let relation = 'subtask';
	return Modal.confirm({
		title: 'Связать задачи?',
		width: 620,
		content: <StoreContext.Provider value={stores}>
			<Space direction="vertical">
				<Radio.Group defaultValue={relation} onChange={event => { relation = event.target.value; }}>
					<Space direction="vertical">
						<Radio value="subtask">Сделать <TaskLink id={source.id} /> подзадачей <TaskLink id={target.id} /></Radio>
						<Radio value="next"><TaskLink id={source.id} /> должна быть сделана до <TaskLink id={target.id} /></Radio>
						<Radio value="previous"><TaskLink id={target.id} /> должна быть сделана до <TaskLink id={source.id} /></Radio>
					</Space>
				</Radio.Group>
			</Space>
		</StoreContext.Provider>,
		okText: 'Применить',
		cancelText: 'Отмена',
		async onOk() {
			try {
				await saveTaskRelation(source, target, relation);
				notify.success('Связь задач сохранена');
			} catch (error) {
				notify.error(notify.describe(error), { title: 'Не удалось связать задачи' });
				// Отклонение оставляет диалог открытым для повторной попытки или отмены.
				throw error;
			}
		},
	});
}
