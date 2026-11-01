import { bitrixResources } from 'config.priv';

// Старый набор оставлен для статических установок без изменения их конфигурации.
const LEGACY_SCRIPTS = [
	'/bitrix/cache/js/s1/light_blue/kernel_main/kernel_main.js',
	'/bitrix/js/main/core/core.js',
	'/bitrix/js/main/core/core_ajax.js',
	'/bitrix/js/main/json/json2.min.js',
	'/bitrix/js/main/core/core_ls.js',
	'/bitrix/js/main/session.js',
	'/bitrix/js/main/core/core_popup.js',
	'/bitrix/js/main/core/core_date.js',
	'/bitrix/js/main/core/core_fx.js',
	'/bitrix/js/main/core/core_webrtc.js',
	'/bitrix/js/main/core/core_dd.js',
	'/bitrix/js/main/core/core_tooltip.js',
	'/bitrix/js/main/core/core_timer.js',
	'/bitrix/js/main/core/core_window.js',
	'/bitrix/js/main/utils.js',
	'/bitrix/js/main/rating_like.js',
	'/bitrix/js/main/dd.js',
	'/bitrix/js/main/core/core_autosave.js',
];

let loading;

/** Подключает один скрипт; ошибка останавливает цепочку зависимостей. */
function loadScript(url) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = url;
		script.async = false;
		script.onload = resolve;
		script.onerror = () => reject(new Error(`Не удалось загрузить ${url}`));
		document.head.appendChild(script);
	});
}

/** Загружает библиотеки один раз либо использует ресурсы PHP-страницы портала. */
export function loadBitrixLibraries() {
	if (loading) return loading;
	loading = (async () => {
		if (window.__BXDASH_PORTAL__) {
			if (!window.BX || typeof window.BX.ready !== 'function') {
				throw new Error('Портал не инициализировал ядро BX');
			}
			return;
		}
		// Заглушка нужна старым библиотекам; существующий BX сохраняем.
		window.BX = window.BX || {};
		const scripts = bitrixResources.scripts === undefined ? LEGACY_SCRIPTS : bitrixResources.scripts;
		if (!Array.isArray(scripts) || scripts.some(url => typeof url !== 'string' || !url)) {
			throw new Error('bitrixResources.scripts должен быть массивом URL');
		}
		for (const url of scripts) await loadScript(url);
	})();
	return loading;
}
