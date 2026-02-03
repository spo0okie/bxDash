import React from 'react';
import UsersStore from './UsersStore';
import MainStore from './MainStore';
import LayoutStore from './LayoutStore';
import TimeStore from './TimeStore';
import PeriodsStore from './Periods/PeriodsStore';
import ItemsMultiStore from './Items/ItemsMultiStore';
import {userList,inventoryUrl,apiUrl,wsUrl,asteriskUrl, zabbixUrl} from 'config.priv';
import { WsStore } from './WsStore';
import AlertsStore from './Items/AlertsStore';

//инициализируем стораджи и настройки

//настройки инициализируем первыми, т.к. они не от чего не зависят
const mainStore=new MainStore();
mainStore.setInventoryUrl(inventoryUrl);
mainStore.setBxUrl(apiUrl);
mainStore.setAsteriskUrl(asteriskUrl);
mainStore.setZabbixUrl(zabbixUrl);

//инициализируем хранилище времени, т.к. от него зависят другие
const timeStore=new TimeStore(mainStore);

//инициализируем пользователей, т.к. им нужны только настройки
const usersStore=new UsersStore(mainStore);
usersStore.init(userList);

//раскладка зависит только от настроек
const layoutStore=new LayoutStore(mainStore,timeStore,usersStore);

//периоды зависят от раскладки и времени
const periodsStore = new PeriodsStore(mainStore, layoutStore,timeStore);

//элементы зависят от настроек, времени, пользователей и периодов
const itemsStore = new ItemsMultiStore(mainStore,timeStore,usersStore,periodsStore); 

const wsStore=wsUrl ? new WsStore(wsUrl,mainStore,usersStore,itemsStore) : null;

const alertStore=new AlertsStore(mainStore);

/* Store helpers */
export const StoreContext = React.createContext({
	main: mainStore,
	time: timeStore,
	layout: layoutStore,
	users: usersStore,
	periods: periodsStore,
	items: itemsStore,
	ws: wsStore,
	alerts: alertStore,
});

//экспортируем stores в window для отладки из консоли
if (typeof window !== 'undefined') {
	window.timeStore = timeStore;
	window.layoutStore = layoutStore;
	window.periodsStore = periodsStore;
	window.mainStore = mainStore;
	window.usersStore = usersStore;
	window.itemsStore = itemsStore;
	window.alertsStore = alertStore;
	console.log('Stores exported to window: timeStore, layoutStore, periodsStore, mainStore, usersStore, itemsStore, alertsStore');
}

