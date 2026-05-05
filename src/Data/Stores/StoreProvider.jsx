import React, { createContext, useContext } from 'react';
import UsersStore from './UsersStore';
import MainStore from './MainStore';
import LayoutStore from './LayoutStore';
import TimeStore from './TimeStore';
import PeriodsStore from './Periods/PeriodsStore';
import ItemsMultiStore from './Items/ItemsMultiStore';
import { userList, inventoryUrl, apiUrl, wsUrl, asteriskUrl, zabbixUrl } from 'config.priv';
import { WsStore } from './WsStore';
import AlertsStore from './Items/AlertsStore';

/**
 * React-контекст со всеми стораджами приложения.
 * Значение задаётся через <StoreContext.Provider value={createStores()}>
 * (см. App.jsx). Без Provider'а контекст null — потребитель должен
 * либо использовать useStores() (бросит понятную ошибку), либо
 * проверять useContext(StoreContext) на null.
 */
export const StoreContext = createContext(null);

/**
 * Создаёт все стораджи приложения и связывает их между собой.
 * Порядок строго фиксирован: каждый следующий зависит от предыдущих.
 *
 * Вызывать ровно один раз — из React-корня через useState с ленивой
 * инициализацией (даёт идемпотентность даже в React.StrictMode), либо
 * из теста, который хочет получить чистый стек с моками.
 */
export function createStores() {
	// настройки инициализируем первыми, т.к. они ни от чего не зависят
	const main = new MainStore();
	main.setInventoryUrl(inventoryUrl);
	main.setBxUrl(apiUrl);
	main.setAsteriskUrl(asteriskUrl);
	main.setZabbixUrl(zabbixUrl);

	// время — от него зависят почти все остальные
	const time = new TimeStore(main);

	// пользователи зависят только от настроек
	const users = new UsersStore(main);
	users.init(userList);

	// раскладка зависит от настроек, времени и пользователей
	const layout = new LayoutStore(main, time, users);

	// периоды зависят от раскладки и времени
	const periods = new PeriodsStore(main, layout, time);

	// элементы зависят от настроек, времени, пользователей и периодов;
	// конструктор сам вызывает periods.attachItemsStore(this)
	const items = new ItemsMultiStore(main, time, users, periods);

	// WS опционален — может быть отключён в конфиге
	const ws = wsUrl ? new WsStore(wsUrl, main, users, items) : null;

	const alerts = new AlertsStore(main);

	return { main, time, users, layout, periods, items, ws, alerts };
}

/**
 * Хук-обёртка для доступа ко всем стораджам из компонентов.
 * Бросит, если вызван вне Provider — это лучше, чем тихий null.
 */
export function useStores() {
	const stores = useContext(StoreContext);
	if (!stores) throw new Error('useStores() called outside of <StoreContext.Provider>');
	return stores;
}
