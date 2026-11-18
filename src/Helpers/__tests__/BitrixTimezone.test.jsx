import TimeStore from 'Data/Stores/TimeStore';
import { bxAuthScheme } from '../BxHelper';
import time from '../TimeHelper';

afterEach(() => {
	time.setStore(null);
	jest.useRealTimers();
	jest.restoreAllMocks();
});

/** Проверяет влияние авторизации на парсинг, отправку и границы календаря. */
test.each([
	['+05:30', '18.11.2026 10:00:05', '2026-11-18T18:30:00Z'],
	['+05:00', '18.11.2026 09:30:05', '2026-11-18T19:00:00Z'],
])('пояс API %s из ответа user/login', async (timezoneOffset, value, midnight) => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date('2026-11-18T20:00:00Z'));
	const store = new TimeStore({ loadOption: () => 'backend', saveOption: jest.fn() });
	jest.spyOn(global, 'fetch').mockResolvedValue({
		ok: true,
		json: async () => ({ auth: true, id: 5, timezoneOffset }),
	});

	expect(await bxAuthScheme.authorize({ baseUrl: '/api/' })).toBe(true);
	expect(store.tzMode).toBe('backend');
	expect(store.tzStrOffset).toBe(timezoneOffset);
	expect(store.today).toBe(Date.parse(midnight));
	const stamp = time.bitrixDateTimeToJs(value);
	expect(stamp).toBe(Date.parse('2026-11-18T04:30:05Z'));
	expect(time.toBitrixTimestamp(stamp)).toBe(1794976205);

	store.setTzMode('browser');
	expect(store.tzOffsetMin).toBe(-new Date().getTimezoneOffset() || 0);
	expect(time.bitrixDateTimeToJs(value)).toBe(stamp);
	expect(time.toBitrixTimestamp(stamp)).toBe(1794976205);
});
