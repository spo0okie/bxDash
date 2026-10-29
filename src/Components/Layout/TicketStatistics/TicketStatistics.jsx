import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Space, Spin, Table } from 'antd';
import { observer } from 'mobx-react';
import { useStores } from 'Data/Stores/StoreProvider';
import { bxJson } from 'Helpers/BxJson';
import notify from 'Helpers/Notify';
import TimeHelper from 'Helpers/TimeHelper';
import { buildTicketStatistics, DAY_MS, monthRange, previousMonth, statisticsCsv, statisticsDetails } from 'Helpers/TicketStatistics';
import './TicketStatistics.css';

/** Число рабочих суток; отсутствие закрытых заявок не превращаем в среднее 0. */
export function formatDays(ms) {
	return ms === null ? '—' : (ms / DAY_MS).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Сохранить видимую таблицу по явному нажатию пользователя. */
function downloadCsv(matrix, filename) {
	const url = URL.createObjectURL(new Blob([statisticsCsv(matrix)], { type: 'text/csv;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

const METRIC_NAMES = { count: 'Все заявки', closed: 'Закрытые', open: 'Открытые', overdue: 'Просроченные',
	held: 'Отложенные', closedHeld: 'Закрытые с паузами', excluded: 'Исключённые' };

/** Модальный отчёт: сводка по всем загруженным сотрудникам и расшифровка каждой цифры. */
const TicketStatistics = observer(() => {
	const { main, users, schedule } = useStores();
	const [month, setMonth] = useState(previousMonth);
	const [filters, setFilters] = useState(() => ({ ...monthRange(previousMonth()), mode: 'created', snapshot: 'period' }));
	const [applied, setApplied] = useState(filters);
	const [report, setReport] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [extra, setExtra] = useState(false);
	const [selection, setSelection] = useState(null);
	const [excluded, setExcluded] = useState(false);
	// order содержит сотрудников с ролью user; выбранный сотрудник доски не влияет на область.
	const employeeIds = users.order.join(',');
	const employees = users.order.map(id => {
		const user = users.items.get(id);
		return { id, name: user?.title || user?.name || `Сотрудник #${id}` };
	});
	const employeeSignature = JSON.stringify(employees);
	const authStatus = main.bx.authStatus;

	useEffect(() => {
		let active = true;
		const controller = new AbortController();
		setReport(null);
		setSelection(null);
		setError(null);
		setLoading(false);
		if (authStatus !== 'OK' || !employeeIds) return () => { active = false; };
		setLoading(true);
		const query = new URLSearchParams({ from: applied.from, to: applied.to, mode: applied.mode, users: employeeIds });
		bxJson(main.bx, `ticket_statistics/get?${query}`, { signal: controller.signal })
			.then(data => {
				if (!Array.isArray(data.rows) || !data.asOf || !data.periodEnd || !Number.isFinite(Number(data.overdueDays))) {
					throw new Error('Сервер вернул некорректные данные статистики');
				}
				if (active) setReport(data);
			})
			.catch(reason => {
				if (!active) return; // Закрытие окна и отмена устаревшего запроса не являются ошибкой отчёта.
				setError(reason.message);
				notify.error(reason.message, { title: 'Статистика заявок' });
			})
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; controller.abort(); };
	}, [main, authStatus, employeeIds, applied]);

	// Подписка на расписание обеспечивает пересчёт после загрузки календаря Inventory.
	const compiled = schedule.compiled;
	const stats = useMemo(() => report ? buildTicketStatistics(report, schedule, JSON.parse(employeeSignature), applied.snapshot) : null,
		[report, schedule, compiled, employeeSignature, applied.snapshot]);
	const details = stats ? statisticsDetails(stats.rows, selection, excluded) : [];

	/** Переход из показателя в соответствующие заявки в том же окне. */
	function selectMetric(summary, metric) {
		setExcluded(false);
		setSelection({ userId: summary.id, name: summary.name, metric });
	}

	/** Обновить период, сохранив остальные фильтры. */
	function selectMonth(value) {
		setMonth(value);
		if (/^\d{4}-\d{2}$/.test(value)) setFilters(current => ({ ...current, ...monthRange(value) }));
	}

	/** Колонка с переходом в расшифровку; средние открывают закрытые заявки. */
	function metricColumn(title, key, metric = key, time = false) {
		return { title, dataIndex: key, key, align: 'right',
			sorter: (a, b) => (a[key] ?? -1) - (b[key] ?? -1),
			render: (value, row) => <Button type="link" size="small" onClick={() => selectMetric(row, metric)}>
				{time ? formatDays(value) : value}
			</Button> };
	}
	const columns = [
		{ title: 'Сотрудник', dataIndex: 'name', key: 'name', fixed: 'left', width: 180 },
		metricColumn('Всего', 'count'), metricColumn('Закрыто', 'closed'),
		metricColumn('Среднее без пауз, дн', 'averageMs', 'closed', true),
		metricColumn('Открыто', 'open'), metricColumn('Просрочено', 'overdue'), metricColumn('Отложено', 'held'),
	];
	if (extra) columns.push(
		metricColumn('Сумма без пауз, дн', 'workMs', 'closed', true),
		metricColumn('Сумма включая паузы, дн', 'totalMs', 'closed', true),
		metricColumn('Среднее включая паузы, дн', 'totalAverageMs', 'closed', true),
		metricColumn('Закрыто с паузами', 'closedHeld'),
		metricColumn('Время пауз закрытых, дн', 'heldMs', 'closedHeld', true),
		metricColumn('Время заявок с нарушением SLA, дн', 'overdueMs', 'overdue', true),
	);
	const detailColumns = [
		{ title: 'Заявка', dataIndex: 'id', width: 90, render: id => <a href={`/bitrix/admin/ticket_edit.php?ID=${id}`} target="_blank" rel="noreferrer">#{id}</a> },
		{ title: 'Название', dataIndex: 'title' }, { title: 'Сотрудник', dataIndex: 'name' },
		{ title: 'Создана', dataIndex: 'createdAt', render: value => TimeHelper.strDateTimeHumanLong(value) },
		{ title: 'Закрыта', dataIndex: 'closeAt', render: value => value ? TimeHelper.strDateTimeHumanLong(value) : '—' },
		{ title: 'Состояние', render: (_, row) => row.closed ? 'Закрыта' : row.held ? 'Отложена' : 'Открыта' },
		{ title: 'Время без пауз, дн', dataIndex: 'workMs', align: 'right', render: value => formatDays(value) },
	];
	if (excluded) detailColumns.push({ title: 'Причина исключения', dataIndex: 'exclusion' });

	/** CSV содержит те же столбцы и строки, которые сейчас видны в таблице. */
	function exportSummary() {
		const csvColumns = columns.map(column => ({ ...column, value: row => column.key.endsWith('Ms')
			? formatDays(row[column.key]) : row[column.key] }));
		downloadCsv([csvColumns.map(column => column.title), ...[...stats.summaries, stats.total]
			.map(row => csvColumns.map(column => column.value(row)))], `заявки-${applied.from}-${applied.to}.csv`);
	}

	return <div className="ticketStatistics">
		<form className="ticketStatisticsFilters" onSubmit={event => {
			event.preventDefault(); setExcluded(false); setApplied({ ...filters });
		}}>
			<label>Месяц<input type="month" value={month} onChange={event => selectMonth(event.target.value)} /></label>
			<Button aria-label="Предыдущий месяц" onClick={() => {
				const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); selectMonth(date.toISOString().slice(0, 7));
			}}>‹</Button>
			<Button aria-label="Следующий месяц" onClick={() => {
				const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); selectMonth(date.toISOString().slice(0, 7));
			}}>›</Button>
			<label>С<input aria-label="Начало периода" type="date" required value={filters.from}
				onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
			<label>По<input aria-label="Конец периода" type="date" required min={filters.from} value={filters.to}
				onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
			<label>Отбор<select aria-label="Отбор заявок" value={filters.mode} onChange={event => setFilters({ ...filters, mode: event.target.value })}>
				<option value="created">Созданы за период</option><option value="closed">Закрыты за период</option></select></label>
			<label>Состояние<select aria-label="Дата состояния" value={filters.snapshot} onChange={event => setFilters({ ...filters, snapshot: event.target.value })}>
				<option value="period">На конец периода</option><option value="now">На момент загрузки</option></select></label>
			<Button type="primary" htmlType="submit" loading={loading} disabled={!employeeIds || authStatus !== 'OK'}>Показать</Button>
		</form>
		<p className="ticketStatisticsNote">Все {employees.length} сотрудников дашборда. Рабочие сутки по 24 часа; выходные и время в отложенных исключены.</p>
		{authStatus !== 'OK' && <Alert type="warning" showIcon message="Для отчёта требуется авторизация в Bitrix" />}
		{!employeeIds && <Empty description="В дашборде не загружены сотрудники" />}
		{error && <Alert type="error" showIcon message="Не удалось загрузить статистику" description={error} />}
		{loading && <div className="ticketStatisticsLoading"><Spin tip="Загрузка заявок и истории…"><div /></Spin></div>}
		{stats && <>
			<p className="ticketStatisticsNote">Период: {applied.from} — {applied.to}. Состояние на {TimeHelper.strDateTimeHumanLong(stats.cutoff)}.</p>
			<div className="ticketStatisticsSummary">
				{[['Всего заявок', 'count'], ['Закрыто', 'closed'], ['Среднее без пауз', 'averageMs'], ['Просрочено', 'overdue']].map(([title, key]) =>
					<button key={key} onClick={() => selectMetric(stats.total, key === 'averageMs' ? 'closed' : key)}>
						<span>{title}</span><strong>{key === 'averageMs' ? `${formatDays(stats.total[key])} дн` : stats.total[key]}</strong>
					</button>)}
			</div>
			<Space wrap className="ticketStatisticsToolbar">
				<Checkbox checked={extra} onChange={event => setExtra(event.target.checked)}>Дополнительные столбцы</Checkbox>
				<Button onClick={exportSummary}>Скачать CSV</Button>
				<Button onClick={() => { setSelection({ userId: 'total', name: 'Все сотрудники', metric: 'excluded' }); setExcluded(true); }}>
					Исключённые заявки ({stats.rows.filter(row => row.exclusion).length})</Button>
			</Space>
			<Table size="small" rowKey="id" columns={columns} dataSource={stats.summaries} pagination={false} scroll={{ x: extra ? 1900 : 950 }}
				summary={() => <Table.Summary.Row>{columns.map((column, index) => <Table.Summary.Cell key={column.key} index={index} align={index ? 'right' : 'left'}>
					<strong>{index === 0 ? 'Итого' : column.render(stats.total[column.key], stats.total)}</strong>
				</Table.Summary.Cell>)}</Table.Summary.Row>} />
			{selection && <section className="ticketStatisticsDetails">
				<Space wrap><h3>{selection.name}: {METRIC_NAMES[selection.metric]} ({details.length})</h3>
					<Button size="small" onClick={() => setSelection(null)}>Скрыть расшифровку</Button>
					<Button size="small" onClick={() => downloadCsv([
						['ID', 'Название', 'Сотрудник', 'Время без пауз, дн', 'Причина исключения'],
						...details.map(row => [row.id, row.title, row.name, formatDays(row.workMs), row.exclusion]),
					], `заявки-расшифровка-${applied.from}-${applied.to}.csv`)}>Скачать список CSV</Button>
				</Space>
				<Table size="small" rowKey="id" columns={detailColumns} dataSource={details} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1100 }}
					expandable={{ expandedRowRender: row => row.exclusion ? <p>{row.exclusion}</p> : <div>
						<p>По рабочему календарю: {formatDays(row.totalMs)} дн − отложенность: {formatDays(row.heldMs)} дн = <strong>{formatDays(row.workMs)} дн</strong>.</p>
						{row.intervals.length ? <ul>{row.intervals.map(interval => <li key={interval.start}>
							{TimeHelper.strDateTimeHumanLong(interval.start)} — {TimeHelper.strDateTimeHumanLong(interval.end)}
							{' ('}{formatDays(schedule.workMsBetween(interval.start, interval.end))} рабочих дн)</li>)}</ul> : <p>Отложенных интервалов нет.</p>}
					</div> }} />
			</section>}
			<details className="ticketStatisticsMethod"><summary>Правила расчёта и исключения</summary>
				<p>Среднее — суммарное время закрытых заявок без пауз, делённое на их количество. При отсутствии закрытых заявок — прочерк.
					В «Просрочено» входят открытые и закрытые заявки с временем без пауз более {report.overdueDays} рабочих суток.
					Для закрытых время считается до завершения, для открытых — до даты выбранного состояния.</p>
				<p>Не учитываются запросы на изменение, заявки «Создана задача», тестовые заявки, обращения от техподдержки и ручной список исключений исходного отчёта.</p>
				<p>Закрытие — дата закрытия Bitrix либо последнее решение техподдержки, ожидающее подтверждения.
					Срез прошлого периода основан на доступных датах закрытия и пауз. Ответственный, категория и статус берутся текущие;
					повторные открытия и прежние решения без полной истории статусов восстановить нельзя.</p>
				<p>{schedule.hasLoadedSchedule ? 'Используется рабочий календарь Inventory.' : 'Календарь Inventory не загружен: используется пн–пт без праздников.'}</p>
			</details>
		</>}
	</div>;
});

/** Кнопка отчёта в верхней панели; используется существующее широкое модальное окно. */
export const TicketStatisticsButton = observer(() => {
	const { layout } = useStores();
	return <button className="" title="Статистика заявок" aria-label="Статистика заявок"
		onClick={() => layout.setModal({ title: 'Статистика заявок', content: <TicketStatistics /> })}>статистика</button>;
});

export default TicketStatistics;
