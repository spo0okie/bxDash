import { inventoryUrl } from 'config.priv';
import { bxJson } from 'Helpers/BxJson';
import notify from 'Helpers/Notify';

/**
 * Подмена битриксовых тултипов профиля пользователя на карточку сотрудника из Inventory.
 *
 * Страница битрикса открыта в iframe того же origin, поэтому слушаем наведение прямо в его
 * документе: ссылки вида /bitrix/admin/user_edit.php?ID=<id> перехватываем в capture-фазе
 * (родной qTip события не получает), а свой тултип рисуем в документе bxDash поверх iframe.
 *
 * Цепочка данных: ID битрикса → логин (бэк user/info) → id в Inventory (api/users/search, Basic)
 * → готовая вёрстка карточки (users/ttip, по сессионной куке Inventory).
 */

const LINK_SELECTOR = 'a[href*="/bitrix/admin/user_edit.php"]';
const SHOW_DELAY = 300;
const HIDE_DELAY = 250;
const TTIP_WIDTH = 560;
const TTIP_MAX_HEIGHT = 520;
const GAP = 6;

// users/ttip отдаёт голый фрагмент без <head>, поэтому стили Inventory (AppAsset) подключаем сами
const INVENTORY_CSS = [
	'css/custom.css',
	'css/site.css',
	'css/qtip.css',
	'css/arms.css',
	'css/org-phones.css',
	'css/page-header.css',
	'css/scans.css',
	'css/schedules.css',
	'css/state-colors.css',
	'css/tables.css',
	'css/markers.css',
	'css/bootstrap.css',
	'fontawesome/css/all.min.css',
	'css/themes.css',
];

/** ID пользователя битрикса из ссылки на его профиль (null, если это не такая ссылка) */
export function bitrixUserId(href) {
	if (!href) return null;
	const match = /\/bitrix\/admin\/user_edit\.php\?(?:.*&)?ID=(\d+)/i.exec(String(href).replace(/&amp;/g, '&'));
	return match ? Number(match[1]) : null;
}

/** Документ для iframe тултипа: фрагмент карточки + стили Inventory */
export function ttipDocument(html, baseUrl = inventoryUrl) {
	const css = INVENTORY_CSS.map((file) => '<link rel="stylesheet" href="' + file + '">').join('');
	return '<!DOCTYPE html><html><head><meta charset="utf-8">'
		+ '<base href="' + baseUrl + '" target="_blank">'
		+ css
		+ '<style>html,body{margin:0;background:#fff}body{padding:10px}</style>'
		+ '</head><body>' + html + '</body></html>';
}

const cards = new Map(); // ID битрикса → Promise<html карточки>

async function fetchCard(main, bxId) {
	const bxUser = await bxJson(main.bx, 'user/info/' + bxId);
	const found = await main.inventory.fetch('api/users/search?login=' + encodeURIComponent(bxUser.login));
	if (found.status === 404) throw new Error('Сотрудник ' + bxUser.login + ' не найден в Inventory');
	if (!found.ok) throw new Error('Inventory: HTTP ' + found.status + ' при поиске ' + bxUser.login);
	const invUser = await found.json();
	if (!invUser?.id) throw new Error('Сотрудник ' + bxUser.login + ' не найден в Inventory');
	// саму карточку берём по живой сессии Inventory (кука через CORS), без Basic-заголовка
	let card;
	try {
		card = await fetch(inventoryUrl + 'users/ttip?id=' + invUser.id, { credentials: 'include' });
	} catch (error) {
		throw new Error('Inventory не отдал карточку ' + bxUser.login + ' (сеть или запрет CORS): ' + notify.describe(error));
	}
	if (card.status === 401 || card.status === 403) throw new Error('Нет активной сессии в Inventory — войдите в него в этом браузере');
	if (!card.ok) throw new Error('Inventory: HTTP ' + card.status + ' при загрузке карточки ' + bxUser.login);
	return card.text();
}

function loadCard(main, bxId) {
	if (!cards.has(bxId)) {
		const promise = fetchCard(main, bxId);
		// неудачу не кэшируем — при следующем наведении попробуем снова
		promise.catch(() => cards.delete(bxId));
		cards.set(bxId, promise);
	}
	return cards.get(bxId);
}

// Тултип один на всё приложение
let box = null;
let current = null; // { link, iframe } — над чем сейчас показан/готовится тултип
let showTimer = null;
let hideTimer = null;
let watchTimer = null;
let requestSeq = 0;

function ensureBox() {
	if (box) return box;
	box = document.createElement('div');
	box.className = 'inventoryUserTtip';
	Object.assign(box.style, {
		position: 'fixed',
		zIndex: 3000,
		display: 'none',
		width: TTIP_WIDTH + 'px',
		maxWidth: 'calc(100vw - 16px)',
		background: '#fff',
		color: '#222',
		border: '1px solid rgba(0,0,0,0.25)',
		borderRadius: '6px',
		boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
		overflow: 'hidden',
	});
	box.addEventListener('mouseenter', () => clearTimeout(hideTimer));
	box.addEventListener('mouseleave', scheduleHide);
	document.body.appendChild(box);
	return box;
}

function place() {
	if (!box || !current) return;
	const frame = current.iframe.getBoundingClientRect();
	const link = current.link.getBoundingClientRect();
	const width = box.offsetWidth;
	const height = box.offsetHeight;
	const left = Math.max(8, Math.min(frame.left + link.left, window.innerWidth - width - 8));
	let top = frame.top + link.bottom + GAP;
	// не помещается снизу — показываем над ссылкой
	if (top + height > window.innerHeight - 8) {
		const above = frame.top + link.top - GAP - height;
		top = above >= 8 ? above : Math.max(8, window.innerHeight - height - 8);
	}
	box.style.left = left + 'px';
	box.style.top = top + 'px';
}

function setMessage(text) {
	const el = ensureBox();
	el.textContent = text;
	el.style.padding = '8px 12px';
	el.style.display = 'block';
	place();
}

function setCard(html) {
	const el = ensureBox();
	el.textContent = '';
	el.style.padding = '0';
	const frame = document.createElement('iframe');
	frame.title = 'Профиль сотрудника';
	Object.assign(frame.style, { display: 'block', width: '100%', height: '120px', border: '0' });
	frame.addEventListener('load', () => {
		const doc = frame.contentDocument;
		if (!doc) return;
		const fit = () => {
			frame.style.height = Math.min(doc.documentElement.scrollHeight, TTIP_MAX_HEIGHT) + 'px';
			place();
		};
		fit();
		// фото и шрифты догружаются позже и меняют высоту
		if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(doc.body);
	});
	frame.srcdoc = ttipDocument(html);
	el.appendChild(frame);
	el.style.display = 'block';
	place();
}

function hide() {
	clearTimeout(showTimer);
	clearTimeout(hideTimer);
	clearInterval(watchTimer);
	requestSeq++;
	current = null;
	if (box) {
		box.style.display = 'none';
		box.textContent = '';
	}
}

function scheduleHide() {
	clearTimeout(showTimer);
	clearTimeout(hideTimer);
	hideTimer = setTimeout(hide, HIDE_DELAY);
}

function show(main, iframe, link, bxId) {
	current = { link, iframe };
	const seq = ++requestSeq;
	setMessage('Загрузка профиля…');
	// окно могли закрыть с клавиатуры — тогда mouseout не придёт
	clearInterval(watchTimer);
	watchTimer = setInterval(() => {
		if (!iframe.isConnected || !link.isConnected) hide();
	}, 500);
	loadCard(main, bxId).then(
		(html) => { if (seq === requestSeq) setCard(html); },
		(error) => {
			notify.error(notify.describe(error), { title: 'Профиль пользователя ' + bxId + ' не загружен' });
			if (seq === requestSeq) setMessage(notify.describe(error));
		},
	);
}

/** Убрать с ссылки родной тултип битрикса (qTip) и браузерный title */
function dropNativeTtip(win, link) {
	try {
		const $ = win.jQuery;
		if ($ && $.fn && $.fn.qtip) $(link).qtip('destroy', true);
	} catch (error) {
		// qTip на ссылке мог быть ещё не создан — от него всё равно закрывает перехват событий
		console.log('InventoryUserTtip: qtip destroy failed', error);
	}
	link.removeAttribute('title');
}

/**
 * Подключить подмену тултипов к iframe со страницей битрикса. Вызывать из onLoad:
 * при каждой перезагрузке страницы внутри iframe документ новый, слушатели вешаются заново.
 * @param {HTMLIFrameElement} iframe
 * @param {MainStore} main
 */
export function attachInventoryUserTtips(iframe, main) {
	let doc;
	try {
		doc = iframe.contentDocument;
	} catch (error) {
		doc = null;
	}
	if (!doc) {
		notify.warning('Нет доступа к содержимому окна — профили сотрудников из Inventory показаны не будут');
		return;
	}
	const win = doc.defaultView;
	const linkOf = (e) => (e.target && e.target.closest ? e.target.closest(LINK_SELECTOR) : null);

	// не пускаем события наведения к обработчикам битрикса
	const block = (e) => { if (linkOf(e)) e.stopPropagation(); };
	doc.addEventListener('mouseenter', block, true);
	doc.addEventListener('mousemove', block, true);

	doc.addEventListener('mouseover', (e) => {
		const link = linkOf(e);
		if (!link) return;
		e.stopPropagation();
		const bxId = bitrixUserId(link.getAttribute('href'));
		if (!bxId) return;
		dropNativeTtip(win, link);
		clearTimeout(hideTimer);
		if (current && current.link === link) return;
		clearTimeout(showTimer);
		showTimer = setTimeout(() => show(main, iframe, link, bxId), SHOW_DELAY);
	}, true);

	doc.addEventListener('mouseout', (e) => {
		const link = linkOf(e);
		if (!link) return;
		// переход между дочерними узлами той же ссылки — не уход
		if (e.relatedTarget && link.contains(e.relatedTarget)) return;
		scheduleHide();
	}, true);

	doc.addEventListener('scroll', hide, true);
	win.addEventListener('pagehide', hide);
}
