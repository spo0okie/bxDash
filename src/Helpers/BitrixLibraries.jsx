import { bitrixResources } from 'config.priv';

const RESOURCES_ROUTE = 'portal/resources';

let loading;

/** Подключает скрипт и ждёт выполнения внешнего файла или модуля. */
function loadScript(script) {
	return new Promise((resolve, reject) => {
		script.async = false;
		const waitsForLoad = script.hasAttribute('src') || script.type === 'module';
		if (waitsForLoad) {
			script.onload = resolve;
			script.onerror = () => reject(new Error(`Не удалось загрузить ${script.src || 'модуль Bitrix'}`));
		}
		document.head.appendChild(script);
		if (!waitsForLoad) resolve();
	});
}

/** Загружает ресурсы авторизованного API того же портала в порядке их вывода. */
async function loadPortalAssets(backend) {
	const endpoint = new URL(backend.baseUrl + RESOURCES_ROUTE, window.location.href);
	if (endpoint.origin !== window.location.origin) {
		throw new Error('Для загрузки ресурсов Bitrix apiUrl должен указывать на текущий сайт');
	}
	const response = await backend.fetch(RESOURCES_ROUTE, { cache: 'no-store', redirect: 'error' });
	if (!response.ok) throw new Error(`Ресурсы Bitrix: HTTP ${response.status}`);

	const page = new window.DOMParser().parseFromString(await response.text(), 'text/html');
	// Страница входа или ответ Vite не содержат эту метку.
	if (!page.head.querySelector('meta[name="bxdash-portal-assets"][content="1"]')) {
		throw new Error('API не вернул ресурсы Bitrix. Проверьте маршрут и сессию портала');
	}

	for (const resource of page.querySelectorAll('script, style, link[rel~="stylesheet"]')) {
		const node = document.createElement(resource.localName);
		for (const { name, value } of resource.attributes) {
			// Выполняем скрипты последовательно, без обработчиков событий из HTML.
			if (name === 'async' || name === 'defer' || name.startsWith('on')) continue;
			node.setAttribute(name, name === 'src' || name === 'href' ? new URL(value, endpoint).href : value);
		}
		node.textContent = resource.textContent;
		if (node.localName === 'script') await loadScript(node);
		else document.head.appendChild(node);
	}
}

/** Проверяет, что PHP-профиль вывел рабочее ядро. */
function ensurePortalCore() {
	if (typeof window.BX?.ready !== 'function') {
		throw new Error('Портал не инициализировал ядро BX');
	}
}

/** Загружает библиотеки один раз из API или из явно заданного списка. */
export function loadBitrixLibraries(backend) {
	if (loading) return loading;
	loading = (async () => {
		const { scripts } = bitrixResources;
		if (scripts === undefined) {
			await loadPortalAssets(backend);
			ensurePortalCore();
			return;
		}
		// Заглушка нужна старым библиотекам; существующий BX сохраняем.
		window.BX = window.BX || {};
		if (!Array.isArray(scripts) || scripts.some(url => typeof url !== 'string' || !url)) {
			throw new Error('bitrixResources.scripts должен быть массивом URL');
		}
		for (const url of scripts) {
			const script = document.createElement('script');
			script.src = url;
			await loadScript(script);
		}
	})();
	return loading;
}
