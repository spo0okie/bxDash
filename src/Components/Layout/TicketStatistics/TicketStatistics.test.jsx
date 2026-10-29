import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import ScheduleStore from 'Data/Stores/ScheduleStore';
import { useStores } from 'Data/Stores/StoreProvider';
import { bxJson } from 'Helpers/BxJson';
import notify from 'Helpers/Notify';
import TicketStatistics, { TicketStatisticsButton } from './TicketStatistics';

jest.mock('Data/Stores/StoreProvider', () => ({ useStores: jest.fn() }));
jest.mock('Helpers/BxJson', () => ({ bxJson: jest.fn() }));
jest.mock('Helpers/Notify', () => ({ __esModule: true, default: { error: jest.fn() } }));
// jsdom не поддерживает современные CSS-селекторы Ant Design; поведение компонентов оставляем реальным.
jest.mock('@ant-design/cssinjs', () => ({ ...jest.requireActual('@ant-design/cssinjs'), useStyleRegister: () => node => node }));
jest.mock('rc-util/lib/getScrollBarSize', () => ({ __esModule: true, default: () => 0,
	getTargetScrollBarSize: () => ({ width: 0, height: 0 }) }));

/** Настроить ответ без портала; сотрудник персональной доски не сужает отчёт. */
function setup() {
	const stores = { main: { bx: { authStatus: 'OK' } }, layout: { setModal: jest.fn() },
		users: { order: [1, 2], selected: 1, items: new Map([[1, { title: 'Иванов' }], [2, { title: 'Петров' }]]) },
		schedule: new ScheduleStore({}, 0) };
	useStores.mockReturnValue(stores);
	bxJson.mockResolvedValue({ asOf: '12.10.2026 12:00:00', periodEnd: '30.09.2026 23:59:59', overdueDays: 2, rows: [
		{ ID: 101, TITLE: 'Настройка почты', RESPONSIBLE_USER_ID: 1, DATE_CREATE: '07.09.2026 12:00:00',
			REPORT_CLOSE_DATE: '08.09.2026 12:00:00', HOLD_INTERVALS: [], EXCLUSION_REASON: null },
		{ ID: 102, TITLE: 'ТЕСТ', RESPONSIBLE_USER_ID: 2, DATE_CREATE: '07.09.2026 12:00:00',
			REPORT_CLOSE_DATE: null, HOLD_INTERVALS: [], EXCLUSION_REASON: 'Тестовая заявка' },
	] });
	return stores;
}

beforeEach(() => jest.clearAllMocks());

test('кнопка открывает существующее модальное окно', () => {
	const stores = setup();
	render(<TicketStatisticsButton />);
	fireEvent.click(screen.getByRole('button', { name: 'Статистика заявок' }));
	expect(stores.layout.setModal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Статистика заявок' }));
});

test('загружает всех сотрудников, показывает расшифровку и причины исключений', async () => {
	setup();
	render(<TicketStatistics />);
	await screen.findByText('Иванов');
	expect(bxJson.mock.calls[0][1]).toContain('users=1%2C2');
	expect(bxJson.mock.calls[0][1]).not.toContain('sla');
	const employeeRow = screen.getByText('Иванов').closest('tr');
	fireEvent.click(within(employeeRow).getByRole('button', { name: '1,00' }));
	await screen.findByText('Настройка почты');
	fireEvent.click(screen.getByRole('button', { name: 'Исключённые заявки (1)' }));
	await screen.findByText('Тестовая заявка');
	expect(screen.queryByText('Настройка почты')).not.toBeInTheDocument();
});

test('ошибка API видна в окне и уведомлении, повторная загрузка доступна', async () => {
	setup();
	bxJson.mockRejectedValueOnce(new Error('HTTP 500: история недоступна'));
	render(<TicketStatistics />);
	await screen.findByText('HTTP 500: история недоступна');
	expect(notify.error).toHaveBeenCalledWith('HTTP 500: история недоступна', expect.anything());
	fireEvent.click(await screen.findByRole('button', { name: 'Показать' }));
	await waitFor(() => expect(screen.getByText('Иванов')).toBeInTheDocument());
});
