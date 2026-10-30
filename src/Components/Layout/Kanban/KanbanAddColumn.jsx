import React, { useState, useCallback, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import { Dropdown } from 'antd';
import { useStores } from "Data/Stores/StoreProvider";
import { KANBAN_SYSTEM_COLUMNS } from 'Data/kanbanSystemColumns';

/**
 * Меню добавления системного столбца или ввода названия настраиваемой колонки.
 * Столбец создаётся на бэке только после Enter с непустым названием —
 * безымянных заготовок не остаётся. Escape и потеря фокуса с пустым полем отменяют.
 *
 * @param {number} props.owner владелец доски
 */
const KanbanAddColumn = observer(({ owner }) => {
	const { stages, layout } = useStores();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState('');
	const [saving, setSaving] = useState(false);
	const inputRef = useRef(null);
	const cancelled = useRef(false);

	const start = useCallback(() => {
		cancelled.current = false;
		setValue('');
		setEditing(true);
	}, []);

	useEffect(() => {
		if (editing && inputRef.current) inputRef.current.focus();
	}, [editing]);

	const finish = useCallback(() => {
		const title = value.trim();
		if (cancelled.current || !title) {
			setEditing(false);
			return;
		}
		setSaving(true);
		stages.create(owner, title).then(stage => {
			setSaving(false);
			// при ошибке (уведомление уже показано) оставляем поле с текстом — можно поправить и повторить
			if (stage) setEditing(false);
		});
	}, [value, stages, owner]);

	const onKeyDown = useCallback((e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			finish();
		}
		if (e.key === 'Escape') {
			cancelled.current = true;
			setEditing(false);
		}
	}, [finish]);

	const onBlur = useCallback(() => {
		// уход из пустого поля — отмена; с текстом — оставляем как есть, чтобы не создать столбец случайно
		if (!value.trim() && !saving) setEditing(false);
	}, [value, saving]);

	if (!editing) {
		const enabled = layout.systemColumnsOf(owner).map(column => column.key);
		return (
			<Dropdown
				trigger={['click']}
				menu={{
					items: [
						{ key: 'custom', label: 'Настраиваемая колонка' },
						...KANBAN_SYSTEM_COLUMNS.map(column => ({
							key: column.key, label: column.title, disabled: enabled.includes(column.key),
						})),
					],
					onClick: ({ key }) => key === 'custom' ? start() : layout.setKanbanSystemColumn(owner, key, true),
				}}
			>
				<button className="kanbanAddColumn" title="Добавить столбец">+ столбец ▾</button>
			</Dropdown>
		);
	}

	return (
		<div className="kanbanAddColumn editing">
			<input
				ref={inputRef}
				className="kanbanTitleInput"
				value={value}
				maxLength={255}
				placeholder="Название столбца"
				disabled={saving}
				onChange={e => setValue(e.target.value)}
				onKeyDown={onKeyDown}
				onBlur={onBlur}
			/>
			<span className="kanbanHint">Enter — создать, Esc — отмена</span>
		</div>
	);
});

export default KanbanAddColumn;
