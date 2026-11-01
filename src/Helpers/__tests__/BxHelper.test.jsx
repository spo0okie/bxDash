import { bxAuthScheme } from '../BxHelper';

/** Успешный вход определяется авторизацией пользователя, а не устаревшим хешем. */
describe('Bitrix authorize', () => {
	const originalFetch = global.fetch;
	afterEach(() => { global.fetch = originalFetch; });

	test.each(['legacy-hash', null, undefined])('поддерживает hash=%s', async hash => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true, json: async () => ({ auth: true, id: '5', hash }),
		});
		const backend = { baseUrl: '/api/', login: 'user', password: 'password', token: 'old' };
		expect(await bxAuthScheme.authorize(backend)).toBe(true);
		expect(backend.token).toBe(hash || '');
		const options = bxAuthScheme.reqOptions({}, backend);
		expect(options.headers.Authorization).toBe('Basic ' + btoa('user:password'));
	});

	test.each([
		{ auth: false, id: 5, hash: 'hash' },
		{ auth: true, id: null, hash: 'hash' },
	])('отклоняет неподтверждённого пользователя %j', async data => {
		global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
		expect(await bxAuthScheme.authorize({ baseUrl: '/api/' })).toBe(false);
	});
});
