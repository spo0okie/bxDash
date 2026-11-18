import { bitrixResources } from 'config.priv';

const RESOURCES_ROUTE = 'portal/resources';
const EXTERNAL_ASSETS = 'script[src], link[rel~="stylesheet"][href]';

let loading;

/** Возвращает уже начатую загрузку ресурсов для действий, которым нужен Bitrix. */
export function waitForBitrixLibraries() {
	return loading;
}

/** Сопоставляет один и тот же файл Bitrix в обычном и минифицированном виде. */
function assetUrl(node) {
	const url = new URL(node.src || node.href);
	url.hash = '';
	if (url.origin === window.location.origin && url.pathname.startsWith('/bitrix/js/')) {
		// Bitrix сам считает числовой суффикс отметкой кеша при проверке уже подключённых файлов.
		if (/^\?\d+$/.test(url.search)) url.search = '';
		url.pathname = url.pathname.replace(/\.min(?=\.(?:js|css)$)/, '');
	}
	return url;
}

/** Учитывает тип скрипта и режим применения стилей при поиске дубликатов. */
function assetKey(node, url = assetUrl(node)) {
	const type = node.type?.trim().toLowerCase();
	const scriptType = node.localName === 'script' && !['text/javascript', 'application/javascript'].includes(type) ? type : '';
	return JSON.stringify([node.localName, scriptType, node.noModule, node.media, url.href]);
}

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
	const assets = page.head.querySelector('meta[name="bxdash-portal-assets"][content="1"]');
	if (!assets) {
		throw new Error('API не вернул ресурсы Bitrix. Проверьте маршрут и сессию портала');
	}

	const seen = new Set(Array.from(document.querySelectorAll(EXTERNAL_ASSETS), node => assetKey(node)));
	const scripts = new Set();
	const styles = new Set();
	for (const resource of page.querySelectorAll('script, style, link[rel~="stylesheet"]')) {
		const node = document.createElement(resource.localName);
		for (const { name, value } of resource.attributes) {
			// Выполняем скрипты последовательно, без обработчиков событий из HTML.
			if (name === 'async' || name === 'defer' || name.startsWith('on')) continue;
			node.setAttribute(name, name === 'src' || name === 'href' ? new URL(value, endpoint).href : value);
		}
		node.textContent = resource.textContent;
		if (node.matches(EXTERNAL_ASSETS)) {
			const url = assetUrl(node);
			const key = assetKey(node, url);
			if (url.origin === window.location.origin && url.pathname.startsWith('/bitrix/')) {
				const loaded = node.localName === 'script' ? scripts : styles;
				loaded.add(url.pathname + url.search);
			}
			if (seen.has(key)) continue;
			seen.add(key);
		}
		if (node.localName === 'script') await loadScript(node);
		else document.head.appendChild(node);
	}
	// Списки BX могли инициализироваться до вставки ресурсов. Синхронизируем их для вложенных окон карточки.
	if (scripts.size) window.BX?.setJSList?.([...scripts]);
	if (styles.size) window.BX?.setCSSList?.([...styles]);
	// Событие load у скрипта возможно и при ошибке выполнения. Проверяем экспорт, обещанный порталом.
	if (assets.dataset.taskFullCard === '1' && typeof window.BX?.Tasks?.V2?.Application?.TaskFullCard !== 'function') {
		throw new Error('Ресурсы портала не зарегистрировали BX.Tasks.V2.Application.TaskFullCard');
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
		const seen = new Set(Array.from(document.scripts).filter(script => script.src).map(script => assetKey(script)));
		for (const url of scripts) {
			const script = document.createElement('script');
			script.src = url;
			const key = assetKey(script);
			if (seen.has(key)) continue;
			seen.add(key);
			await loadScript(script);
		}
	})();
	return loading;
}
