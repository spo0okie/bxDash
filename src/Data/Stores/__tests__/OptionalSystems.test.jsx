// Изолируем фабрику от загрузки данных: проверяем создание систем и запуск подключений.
jest.mock('config.priv', () => ({
	__esModule: true, wsUrl: false, asteriskUrl: false, userList: {}, incomingCallConfig: {},
}));
jest.mock('../BackendSystem', () => jest.fn().mockImplementation(name => ({
	name, availability: 'Uninitialized', authStatus: 'Unauthorized',
	setUrl: jest.fn(), setLoginCredentials: jest.fn(),
})));
jest.mock('../UsersStore', () => jest.fn(() => ({ init: jest.fn() })));
jest.mock('../LayoutStore', () => jest.fn(() => ({})));
jest.mock('../TimeStore', () => jest.fn(() => ({})));
jest.mock('../Periods/PeriodsStore', () => jest.fn(() => ({})));
jest.mock('../Items/ItemsMultiStore', () => jest.fn(() => ({})));
jest.mock('../Items/AlertsStore', () => jest.fn(() => ({})));
jest.mock('../ThemeStore', () => jest.fn(() => ({})));
jest.mock('../ScheduleStore', () => jest.fn(() => ({})));
jest.mock('../NotificationsStore', () => jest.fn(() => ({})));
jest.mock('../StagesStore', () => jest.fn(() => ({})));
jest.mock('../DutyStore', () => jest.fn(() => ({})));
jest.mock('../IncomingCallsStore', () => jest.fn(() => ({})));
jest.mock('../WsStore', () => ({ WsStore: jest.fn(() => ({})) }));

import { runInAction } from 'mobx';
import * as config from 'config.priv';
import { createStores } from '../StoreProvider';
import BackendSystem from '../BackendSystem';
import DutyStore from '../DutyStore';
import IncomingCallsStore from '../IncomingCallsStore';
import { WsStore } from '../WsStore';

/** Отключение исключает и конструирование интеграций, и попытки их авторизации. */
describe('Опциональные WS и Asterisk', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		config.wsUrl = false;
		config.asteriskUrl = false;
	});
	afterEach(() => jest.restoreAllMocks());

	test('false не создаёт телефонию, её опросы и WS и не мешает входу', async () => {
		const stores = createStores();
		expect(stores.ws).toBeNull();
		expect(stores.main.ast22).toBeNull();
		expect(stores.duty).toBeNull();
		expect(stores.incomingCalls).toBeNull();
		expect(WsStore).not.toHaveBeenCalled();
		expect(DutyStore).not.toHaveBeenCalled();
		expect(IncomingCallsStore).not.toHaveBeenCalled();
		for (const backend of [stores.main.bx, stores.main.inventory, stores.main.zabbix]) {
			jest.spyOn(backend, 'setLoginCredentials').mockImplementation(() => {
				runInAction(() => { backend.authStatus = 'OK'; backend.availability = 'OK'; });
			});
		}
		const success = jest.fn();
		const failure = jest.fn();
		await stores.main.authenticate('user', 'password', success, failure);
		expect(success).toHaveBeenCalledTimes(1);
		expect(failure).not.toHaveBeenCalled();
		expect(stores.main.hasErrors).toBe(false);
		expect(BackendSystem.mock.calls.map(([name]) => name)).toEqual(['Bitrix', 'Zabbix', 'Inventory']);
	});

	test.each([
		[false, 'wss://example.test/ws'],
		['https://example.test/ast/', false],
		['https://example.test/ast/', 'wss://example.test/ws'],
	])('интеграции включаются независимо: Asterisk=%s, WS=%s', (asterisk, ws) => {
		config.asteriskUrl = asterisk;
		config.wsUrl = ws;
		const stores = createStores();
		expect(Boolean(stores.main.ast22)).toBe(Boolean(asterisk));
		expect(Boolean(stores.incomingCalls)).toBe(Boolean(asterisk));
		expect(Boolean(stores.duty)).toBe(Boolean(asterisk));
		expect(Boolean(stores.ws)).toBe(Boolean(ws));
		expect(DutyStore).toHaveBeenCalledTimes(asterisk ? 1 : 0);
		expect(IncomingCallsStore).toHaveBeenCalledTimes(asterisk ? 1 : 0);
		expect(WsStore).toHaveBeenCalledTimes(ws ? 1 : 0);
	});
});
