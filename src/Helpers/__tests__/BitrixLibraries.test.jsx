/** Проверяем загрузку зависимостей, отказ цепочки и отсутствие повторной загрузки. */
describe('BitrixLibraries', () => {
	beforeEach(() => {
		jest.resetModules();
		window.__CONFIG__ = { bitrixResources: { scripts: ['/first.js', '/second.js'] } };
		delete window.BX;
		document.head.innerHTML = '';
	});

	afterEach(() => {
		delete window.__CONFIG__;
		delete window.BX;
	});

	test('ждёт первую зависимость, сохраняет BX и не создаёт дубли', async () => {
		window.BX = { existing: true };
		window.__CONFIG__.bitrixResources.scripts.push(window.location.origin + '/first.js');
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
		expect(document.scripts).toHaveLength(2);
		expect(window.BX).toBe(bx);
		expect(loadBitrixLibraries()).toBe(pending);
	});

	test('объединяет повторы JS и CSS Bitrix из head и body и сообщает о них загрузчику BX', async () => {
		delete window.__CONFIG__.bitrixResources.scripts;
		window.BX = { ready: jest.fn(), setJSList: jest.fn(), setCSSList: jest.fn() };
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			text: async () => '<head><meta name="bxdash-portal-assets" content="1">'
				+ '<link rel="stylesheet" href="/bitrix/js/tasks/task-card.bundle.min.css?123">'
				+ '<script src="/bitrix/js/tasks/task-card.bundle.min.js?123"></script></head>'
				+ '<body><script type="text/javascript" src="/bitrix/js/tasks/task-card.bundle.js"></script>'
				+ '<link rel="stylesheet" href="/bitrix/js/tasks/task-card.bundle.css">'
				+ '<link rel="stylesheet" media="print" href="/bitrix/js/tasks/task-card.bundle.css"></body>',
		});
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		const pending = loadBitrixLibraries({ baseUrl: '/back/api/', fetch: fetchMock });
		await Promise.resolve();
		await Promise.resolve();
		// Браузер получает первый URL с исходной отметкой кеша, а не нормализованный ключ.
		expect(document.scripts[0].getAttribute('src')).toBe(window.location.origin + '/bitrix/js/tasks/task-card.bundle.min.js?123');
		document.scripts[0].dispatchEvent(new Event('load'));
		await pending;
		expect(document.scripts).toHaveLength(1);
		expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(2);
		expect(window.BX.setJSList).toHaveBeenCalledWith(['/bitrix/js/tasks/task-card.bundle.js']);
		expect(window.BX.setCSSList).toHaveBeenCalledWith(['/bitrix/js/tasks/task-card.bundle.css']);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('при 404 не запускает зависимый скрипт', async () => {
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		const pending = loadBitrixLibraries();
		const failure = expect(pending).rejects.toThrow('/first.js');
		document.scripts[0].dispatchEvent(new Event('error'));
		await failure;
		expect(document.scripts).toHaveLength(1);
	});

	test('получает авторизованным запросом CSS и скрипты в порядке ответа API', async () => {
		delete window.__CONFIG__.bitrixResources.scripts;
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			text: async () => '<head><meta name="bxdash-portal-assets" content="1"><link rel="stylesheet" href="/bitrix/main.css">'
				+ '<script src="core.js"></script><script>window.BX.messages = true;</script></head>'
				+ '<body><script src="/bitrix/tasks.js"></script></body>',
		});
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		const pending = loadBitrixLibraries({ baseUrl: '/back/api/', fetch: fetchMock });
		await Promise.resolve();
		await Promise.resolve();
		expect(fetchMock).toHaveBeenCalledWith('portal/resources', { cache: 'no-store', redirect: 'error' });
		expect(document.querySelector('link[rel="stylesheet"]').href).toBe(window.location.origin + '/bitrix/main.css');
		expect(document.scripts).toHaveLength(1);
		expect(document.scripts[0].src).toBe(window.location.origin + '/back/api/portal/core.js');
		window.BX = { ready: jest.fn() };
		document.scripts[0].dispatchEvent(new Event('load'));
		await Promise.resolve();
		await Promise.resolve();
		expect(window.BX.messages).toBe(true);
		expect(document.scripts[2].src).toBe(window.location.origin + '/bitrix/tasks.js');
		document.scripts[2].dispatchEvent(new Event('load'));
		await pending;
	});

	test('страница входа без метки не выполняет скрипты', async () => {
		delete window.__CONFIG__.bitrixResources.scripts;
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true, text: async () => '<script src="/login.js"></script>',
		});
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		await expect(loadBitrixLibraries({ baseUrl: '/back/api/', fetch: fetchMock })).rejects.toThrow('Проверьте маршрут и сессию портала');
		expect(document.scripts).toHaveLength(0);
	});

	test('сообщает о сбое, если портал объявил TaskFullCard, а класс не зарегистрирован', async () => {
		delete window.__CONFIG__.bitrixResources.scripts;
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true, text: async () => '<meta name="bxdash-portal-assets" content="1" data-task-full-card="1">',
		});
		window.BX = { ready: jest.fn() };
		const { loadBitrixLibraries } = require('../BitrixLibraries');
		await expect(loadBitrixLibraries({ baseUrl: '/back/api/', fetch: fetchMock })).rejects.toThrow('TaskFullCard');
	});
});
