import MainStore from '../MainStore';
import { bxJson } from 'Helpers/BxJson';
import notify from 'Helpers/Notify';
import { ticketCategoryIds } from 'config.priv';

jest.mock('Helpers/BxJson', () => ({ bxJson: jest.fn() }));
jest.mock('Helpers/Notify', () => ({ error: jest.fn(), describe: error => error.message }));
jest.mock('config.priv', () => ({ ticketCategoryIds: [43] }));

beforeEach(() => { jest.clearAllMocks(); ticketCategoryIds.splice(0, ticketCategoryIds.length, 43); });

test('авторизация запускает одну загрузку, форма использует тот же запрос и кеш', async () => {
	ticketCategoryIds.splice(0, 1, 45, 43);
	const store = new MainStore();
	let resolve;
	bxJson.mockReturnValue(new Promise(done => { resolve = done; }));
	expect(bxJson).not.toHaveBeenCalled();
	store.bx.setAuthStatus('OK');
	const request = store.fetchTicketCategories();
	expect(store.ticketCategoriesLoading).toBe(true);
	expect(bxJson).toHaveBeenCalledTimes(1);
	expect(bxJson).toHaveBeenCalledWith(store.bx, 'ticket/categories');
	const categories = [{ id: 45, name: 'Оборудование' }, { id: 43, name: 'Поддержка' }];
	resolve([...categories].reverse().concat({ id: 99, name: 'Лишняя категория' }));
	await request;
	expect(store.ticketCategories).toEqual(categories);
	expect(store.ticketCategoriesLoading).toBe(false);
	await store.fetchTicketCategories();
	expect(bxJson).toHaveBeenCalledTimes(1);
});

test('отсутствующий в Bitrix ID из конфига даёт понятную ошибку', async () => {
	const store = new MainStore();
	bxJson.mockResolvedValue([{ id: 99, name: 'Другая категория' }]);
	await store.fetchTicketCategories();
	expect(store.ticketCategoriesError).toBe('Категория 43 из config.priv.js не найдена в Bitrix');
	expect(store.ticketCategoriesLoaded).toBe(false);
});

test('ошибка видна пользователю и разрешает повторить загрузку', async () => {
	const store = new MainStore();
	bxJson.mockRejectedValueOnce(new Error('HTTP 500'));
	await store.fetchTicketCategories();
	expect(store.ticketCategoriesError).toBe('HTTP 500');
	expect(store.ticketCategoriesLoading).toBe(false);
	expect(notify.error).toHaveBeenCalled();
	bxJson.mockResolvedValueOnce([{ id: 43, name: 'Поддержка' }]);
	await store.fetchTicketCategories();
	expect(store.ticketCategoriesError).toBeNull();
	expect(store.ticketCategories).toHaveLength(1);
});

test.each([[], {}, [{ id: '43', name: 'Поддержка' }]])('некорректный справочник не кешируется: %j', async response => {
	const store = new MainStore();
	bxJson.mockResolvedValue(response);
	await store.fetchTicketCategories();
	expect(store.ticketCategoriesLoaded).toBe(false);
	expect(store.ticketCategoriesError).toBeTruthy();
});
