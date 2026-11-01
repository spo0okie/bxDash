/** Проверяем загрузку зависимостей, отказ цепочки и отсутствие повторной загрузки. */
describe('BitrixLibraries', () => {
	beforeEach(() => {
		jest.resetModules();
		window.__CONFIG__ = { bitrixResources: { scripts: ['/first.js', '/second.js'] } };
		delete window.__BXDASH_PORTAL__;
		delete window.BX;
		document.head.innerHTML = '';
	});

	afterEach(() => {
		delete window.__CONFIG__;
		delete window.__BXDASH_PORTAL__;
		delete window.BX;
	});

	test('ждёт первую зависимость, сохраняет BX и не создаёт дубли', async () => {
		window.BX = { existing: true };
		const bx = window.BX;
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		const pending = loadBitrixLibraries();
		expect(loadBitrixLibraries()).toBe(pending);
		expect(document.scripts).toHaveLength(1);
		expect(document.scripts[0].getAttribute('src')).toBe('/first.js');
		document.scripts[0].dispatchEvent(new Event('load'));
		await Promise.resolve();
		expect(document.scripts).toHaveLength(2);
		document.scripts[1].dispatchEvent(new Event('load'));
		await pending;
		expect(window.BX).toBe(bx);
		expect(loadBitrixLibraries()).toBe(pending);
	});

	test('при 404 не запускает зависимый скрипт', async () => {
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		const pending = loadBitrixLibraries();
		const failure = expect(pending).rejects.toThrow('/first.js');
		document.scripts[0].dispatchEvent(new Event('error'));
		await failure;
		expect(document.scripts).toHaveLength(1);
	});

	test('в portal использует готовый BX без статических файлов', async () => {
		window.__BXDASH_PORTAL__ = true;
		window.BX = { ready: jest.fn() };
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		await loadBitrixLibraries();
		expect(document.scripts).toHaveLength(0);
	});

	test('сообщает, если portal не вывел ядро', async () => {
		window.__BXDASH_PORTAL__ = true;
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		await expect(loadBitrixLibraries()).rejects.toThrow('не инициализировал');
	});
});
