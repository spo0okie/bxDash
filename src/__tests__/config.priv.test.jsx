/** Проверяет чтение категорий из опубликованного конфига без зашитого списка ID. */
describe('Конфигурация категорий Bitrix', () => {
	const originalConfig = window.__CONFIG__;
	afterEach(() => {
		window.__CONFIG__ = originalConfig;
		jest.resetModules();
	});

	test.each([
		[[1], [1]],
		[1, [1]],
		[[70, 64], [70, 64]],
		[[], []],
	])('ticketCategoryId=%j преобразуется в %j', (value, expected) => {
		jest.resetModules();
		window.__CONFIG__ = { ticketCategoryId: value };
		const { ticketCategoryId, ticketCategoryIds } = require('../config.priv');
		expect(ticketCategoryId).toEqual(value);
		expect(ticketCategoryIds).toEqual(expected);
	});
});
