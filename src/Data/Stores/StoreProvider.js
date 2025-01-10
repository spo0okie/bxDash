import React from 'react';
import UsersStore from './UsersStore';
import MainStore from './MainStore';
import LayoutStore from './LayoutStore';
import TimeStore from './TimeStore';
import PeriodsStore from './PeriodsStore';
import ItemsMultiStore from './Items/ItemsMultiStore';
import {userList,inventoryUrl,apiUrl,wsUrl,asteriskUrl} from 'config.priv';
import { WsStore } from './WsStore';

//инициализируем стораджи и настройки

//настройки инициализируем первыми, т.к. они не от чего не зависят
const mainStore=new MainStore();
mainStore.setInventoryUrl(inventoryUrl);
mainStore.setApiUrl(apiUrl);
mainStore.setWsUrl(wsUrl);
mainStore.setAsteriskUrl(asteriskUrl);
mainStore.init();

//инициализируем хранилище времени, т.к. оно тоже самостоятельное, но от него зависят другие
const timeStore=new TimeStore();

//инициализируем пользователей, т.к. им нужны только настройки
const usersStore=new UsersStore(mainStore);
usersStore.init(userList);

//раскладка зависит только от настроек
const layoutStore=new LayoutStore(mainStore);

//периоды зависят от раскладки и времени
const periodsStore = new PeriodsStore(mainStore, layoutStore,timeStore);

//элементы зависят от настроек, времени, пользователей и периодов
const itemsStore = new ItemsMultiStore(mainStore,timeStore,usersStore,periodsStore); 

const wsStore=new WsStore(wsUrl,mainStore,usersStore,itemsStore);

/* Store helpers */
export const StoreContext = React.createContext({
	main: mainStore,
	time: timeStore,
	layout: layoutStore,
	users: usersStore,
	periods: periodsStore,
	items: itemsStore,
	ws: wsStore
});

