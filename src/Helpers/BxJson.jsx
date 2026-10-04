import notify from "Helpers/Notify";

/**
 * Запрос к бэку Bitrix, возвращающий распарсенный JSON.
 *
 * Бросает Error с человекочитаемым текстом, если: HTTP-ошибка, ответ не JSON
 * (например HTML PHP fatal) или бэк вернул {result:'error', error:...}.
 * Вызывающий обязан показать ошибку пользователю (notify.error) — молча её глотать нельзя.
 *
 * @param {BackendSystem} bx   бэкенд (main.bx)
 * @param {string} endpoint    конечная точка, например 'stage/list/5'
 * @param {Object} options     опции fetch
 */
export async function bxJson(bx, endpoint, options = {}) {
	const response = await bx.fetch(endpoint, options);
	const raw = await response.text();
	let data;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		throw new Error((response.ok ? 'Некорректный ответ сервера: ' : 'HTTP ' + response.status + ': ') + notify.describe(raw));
	}
	if (!response.ok || data?.result === 'error' || data?.error) {
		throw new Error(notify.describe(data));
	}
	return data;
}

/** То же для POST с JSON-телом. */
export function bxPostJson(bx, endpoint, body = {}) {
	return bxJson(bx, endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}
