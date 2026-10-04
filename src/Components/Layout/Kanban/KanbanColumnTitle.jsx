import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { Dropdown } from "antd";
import { useStores } from "Data/Stores/StoreProvider";

/** Палитра столбцов: формат #rrggbb — тот, что принимает бэкенд */
const COLORS = [
	{ value: '#e53935', label: 'красный' },
	{ value: '#fb8c00', label: 'оранжевый' },
	{ value: '#fdd835', label: 'жёлтый' },
	{ value: '#43a047', label: 'зелёный' },
	{ value: '#00acc1', label: 'бирюзовый' },
	{ value: '#1e88e5', label: 'синий' },
	{ value: '#8e24aa', label: 'фиолетовый' },
	{ value: '#757575', label: 'серый' },
];

/**
 * Заголовок столбца канбана: название, счётчик, меню управления, сворачивание.
 *
 * Название правится на месте (двойной клик или пункт меню): Enter и потеря фокуса сохраняют,
 * Escape отменяет. У системного столбца «Завершённые» (stage === null) управления нет.
 *
 * @param {Object|null} props.stage    стадия; null — системный столбец
 * @param {string}      props.title    отображаемое название
 * @param {number}      props.count    число карточек в столбце
 * @param {Function}    props.onToggle свернуть столбец
 */
const KanbanColumnTitle = observer(({ stage, title, count, onToggle }) => {
	const { stages, layout } = useStores();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState('');
	const inputRef = useRef(null);
	const cancelled = useRef(false);

	const startEdit = useCallback(() => {
		if (!stage) return;
		cancelled.current = false;
		setValue(stage.title);
		setEditing(true);
	}, [stage]);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const finishEdit = useCallback(() => {
		setEditing(false);
		if (cancelled.current) return;
		const next = value.trim();
		// пустое название бэкенд не примет — считаем это отменой
		if (!next || next === stage.title) return;
		stages.update(stage.id, { title: next });
	}, [value, stage, stages]);

	const onKeyDown = useCallback((e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.target.blur();	// сохранение — в onBlur, чтобы не сохранить дважды
		}
		if (e.key === 'Escape') {
			cancelled.current = true;
			e.target.blur();
		}
	}, []);

	const others = stage ? stages.stagesOf(stage.userId).filter(s => s.id !== stage.id) : [];

	const remove = useCallback((moveTo) => {
		const target = moveTo ? stages.stageById(moveTo) : null;
		const question = 'Удалить столбец «' + stage.title + '»?'
			+ (count ? '\nКарточек: ' + count + ', они переедут в «' + (target?.title ?? '?') + '».' : '');
		if (!window.confirm(question)) return;
		stages.remove(stage.id, moveTo).then(ok => {
			// чтобы в настройках не копились id удалённых столбцов
			if (ok && layout.isKanbanCollapsed(stage.id)) layout.toggleKanbanCollapsed(stage.id);
		});
	}, [stages, layout, stage, count]);

	const menuItems = useMemo(() => {
		if (!stage) return [];
		return [
			{ key: 'rename', label: 'Переименовать' },
			{
				key: 'color',
				label: 'Цвет',
				children: [
					...COLORS.map(c => ({
						key: 'color:' + c.value,
						label: (
							<span className="kanbanSwatchItem">
								<span className="kanbanSwatch" style={{ background: c.value }} />
								{c.label}{stage.color === c.value ? ' ✓' : ''}
							</span>
						),
					})),
					{ key: 'color:', label: 'без цвета' + (stage.color ? '' : ' ✓') },
				],
			},
			{ key: 'left', label: 'Сдвинуть влево', disabled: !stages.canMove(stage.id, -1) },
			{ key: 'right', label: 'Сдвинуть вправо', disabled: !stages.canMove(stage.id, 1) },
			{ key: 'collapse', label: 'Свернуть' },
			stage.isDefault
				? { key: 'delete', label: 'Удалить', disabled: true, title: 'Столбец по умолчанию удалить нельзя: в нём лежит всё, что никуда не разложено' }
				: count === 0
					// пустой столбец: переносить нечего, выбирать не из чего
					? { key: 'delete:', label: 'Удалить', danger: true }
					: {
						key: 'delete',
						label: 'Удалить',
						danger: true,
						children: others.map(s => ({ key: 'delete:' + s.id, label: 'карточки — в «' + s.title + '»' })),
					},
		];
		// others пересоздаётся на каждый рендер — зависимость от его состава через строку
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stage, stages, count, others.map(s => s.id + ':' + s.title).join('|')]);

	const onMenuClick = useCallback(({ key }) => {
		if (key === 'rename') return startEdit();
		if (key === 'left') return stages.move(stage.id, -1);
		if (key === 'right') return stages.move(stage.id, 1);
		if (key === 'collapse') return onToggle();
		if (key.startsWith('color:')) {
			const color = key.slice('color:'.length) || null;
			if (color !== stage.color) stages.update(stage.id, { color });
			return;
		}
		if (key.startsWith('delete:')) return remove(Number(key.slice('delete:'.length)) || null);
	}, [stage, stages, startEdit, onToggle, remove]);

	return (
		<div className="kanbanColumnTitle">
			{stage && (
				<Dropdown menu={{ items: menuItems, onClick: onMenuClick }} trigger={['click']}>
					<button className="kanbanMenu" title="Управление столбцом">⋯</button>
				</Dropdown>
			)}
			{editing ? (
				<input
					ref={inputRef}
					className="kanbanTitleInput"
					value={value}
					maxLength={255}
					onChange={e => setValue(e.target.value)}
					onKeyDown={onKeyDown}
					onBlur={finishEdit}
				/>
			) : (
				<h3
					title={stage ? title + (stage.isDefault ? ' — столбец по умолчанию' : '') + '\nДвойной клик — переименовать' : title}
					onDoubleClick={startEdit}
				>
					{stage?.isDefault && <span className="kanbanDefaultMark">⌂ </span>}
					{title}
				</h3>
			)}
			<span className="kanbanCount">{count}</span>
			<button className="kanbanCollapse" onClick={onToggle} title="Свернуть столбец">‹</button>
		</div>
	);
});

export default KanbanColumnTitle;
