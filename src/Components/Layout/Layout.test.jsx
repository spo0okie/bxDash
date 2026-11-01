import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import Layout from './Layout';
import ConnectionStates from './ConnectionStates/ConnectionStates';

// Дочерние экраны исключаем: здесь проверяем условие доступа к основному интерфейсу.
jest.mock('./ControlPanel/ControlPanel', () => () => <div data-testid="auth-panel" />);
jest.mock('./Header/AppHeader', () => () => <div data-testid="app-header" />);
jest.mock('./Header/HomeButton', () => () => null);
jest.mock('./Header/Menu/MenuIButton', () => () => null);
jest.mock('./TaskSearch/TaskSearch', () => () => null);
jest.mock('./Sidebar/Sidebar', () => () => null);
jest.mock('./Sidebar/MemoCell', () => () => null);
jest.mock('./Modals', () => () => null);
jest.mock('./IncomingCall/IncomingCallsStack', () => () => null);
jest.mock('./Notifications/NotificationsStack', () => () => null);
jest.mock('./CalendarGrid', () => () => null);
jest.mock('./RightPaneBucket', () => () => null);
jest.mock('./Kanban/KanbanBoard', () => () => null);
jest.mock('./useGlobalShortcuts', () => ({ useGlobalShortcuts: jest.fn() }));

/** При отключённом WS основной интерфейс открывается без повторной формы входа. */
test.each(['OK', 'Unauthorized'])('Layout без WS: обязательные системы %s', status => {
	const stores = {
		users: { selected: null }, layout: {}, items: {}, ws: null,
		main: { bx: { authStatus: status }, zabbix: { authStatus: 'OK' }, inventory: { authStatus: 'OK' } },
	};
	render(<StoreContext.Provider value={stores}><Layout /></StoreContext.Provider>);
	expect(screen.getByTestId('app-header')).toBeInTheDocument();
	if (status === 'OK') expect(screen.queryByTestId('auth-panel')).not.toBeInTheDocument();
	else expect(screen.getByTestId('auth-panel')).toBeInTheDocument();
});

/** В диагностике отключённые системы не маскируются под ошибки соединения. */
test('таблица статусов скрывает отключённые WS и Asterisk', () => {
	const backend = { availability: 'OK', authStatus: 'OK', userId: 5 };
	const stores = { ws: null, main: { bx: backend, zabbix: backend, inventory: backend, ast22: null } };
	render(<StoreContext.Provider value={stores}><ConnectionStates /></StoreContext.Provider>);
	expect(screen.queryByText('Подключение WS channel')).not.toBeInTheDocument();
	expect(screen.queryByText('Подключение Asterisk')).not.toBeInTheDocument();
	expect(screen.getByText('Подключение Bitrix')).toBeInTheDocument();
});
