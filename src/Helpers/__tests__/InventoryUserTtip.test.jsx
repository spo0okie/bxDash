import { bitrixUserId, ttipDocument, attachInventoryUserTtips } from 'Helpers/InventoryUserTtip';

const response = (body, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
	json: async () => body,
});

/** Дождаться завершения цепочки промисов загрузки карточки */
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('bitrixUserId', () => {
	test('достаёт ID из ссылки на профиль', () => {
		expect(bitrixUserId('/bitrix/admin/user_edit.php?lang=ru&ID=1713')).toBe(1713);
		expect(bitrixUserId('/bitrix/admin/user_edit.php?lang=ru&amp;ID=1713')).toBe(1713);
		expect(bitrixUserId('/bitrix/admin/user_edit.php?ID=7&lang=ru')).toBe(7);
	});

	test('чужие ссылки не трогает', () => {
		expect(bitrixUserId('/bitrix/admin/ticket_edit.php?ID=5')).toBeNull();
		expect(bitrixUserId('/bitrix/admin/user_edit.php?lang=ru')).toBeNull();
		expect(bitrixUserId(null)).toBeNull();
	});
});

test('ttipDocument подключает стили Inventory относительно его адреса', () => {
	const html = ttipDocument('<div class="users-ttip">Иванов</div>', 'https://inv.local/web/');
	expect(html).toContain('<base href="https://inv.local/web/" target="_blank">');
	expect(html).toContain('<link rel="stylesheet" href="css/arms.css">');
	expect(html).toContain('<div class="users-ttip">Иванов</div>');
});

describe('attachInventoryUserTtips', () => {
	let iframe, link, main, bitrixHandler;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(console, 'log').mockImplementation(() => {});
		iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		const doc = iframe.contentDocument;
		doc.body.innerHTML = '<a href="/bitrix/admin/user_edit.php?lang=ru&ID=1713" title="Профайл пользователя">1713</a>';
		link = doc.querySelector('a');
		bitrixHandler = jest.fn();
		link.addEventListener('mouseover', bitrixHandler);
		main = {
			bx: { fetch: jest.fn(async () => response({ id: 1713, login: 'ivanov', name: 'Иван Иванов' })) },
			inventory: {
				fetch: jest.fn(async () => response({ id: 42 })),
			},
		};
		// карточка идёт мимо BackendSystem — по сессионной куке
		global.fetch = jest.fn(async () => response('<div class="users-ttip">Иванов</div>'));
		attachInventoryUserTtips(iframe, main);
	});

	afterEach(() => {
		// уводим мышь, чтобы общий тултип спрятался и не протёк в следующий тест
		link.dispatchEvent(new Event('mouseout', { bubbles: true }));
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
		delete global.fetch;
		iframe.remove();
	});

	const hover = () => link.dispatchEvent(new Event('mouseover', { bubbles: true }));
	const box = () => document.querySelector('.inventoryUserTtip');

	test('по наведению грузит карточку из Inventory, не пуская событие к битриксу', async () => {
		hover();
		expect(bitrixHandler).not.toHaveBeenCalled();
		expect(link.hasAttribute('title')).toBe(false);

		jest.advanceTimersByTime(300);
		await flush();

		expect(main.bx.fetch).toHaveBeenCalledWith('user/info/1713', {});
		expect(main.inventory.fetch).toHaveBeenCalledWith('api/users/search?login=ivanov');
		expect(main.inventory.fetch).toHaveBeenCalledTimes(1);
		expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/users\/ttip\?id=42$/), { credentials: 'include' });
		expect(box().style.display).toBe('block');
		expect(box().querySelector('iframe').srcdoc).toContain('<div class="users-ttip">Иванов</div>');
	});

	test('быстрый проход мышью тултип не показывает и запросов не делает', () => {
		hover();
		link.dispatchEvent(new Event('mouseout', { bubbles: true }));
		jest.advanceTimersByTime(1000);

		expect(main.bx.fetch).not.toHaveBeenCalled();
		expect(box() === null || box().style.display === 'none').toBe(true);
	});

	test('после ухода мыши тултип прячется', async () => {
		hover();
		jest.advanceTimersByTime(300);
		await flush();
		link.dispatchEvent(new Event('mouseout', { bubbles: true }));
		jest.advanceTimersByTime(250);

		expect(box().style.display).toBe('none');
	});
});
