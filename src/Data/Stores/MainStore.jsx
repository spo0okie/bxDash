import {action, makeObservable, when, observable, computed, runInAction} from 'mobx';
import Cookies from 'universal-cookie';
import BackendSystem from './BackendSystem';
import { bxAuthScheme } from 'Helpers/BxHelper';
import { zabbixAuthScheme } from 'Helpers/ZabbixHelper';
import { inventoryAuthScheme } from 'Helpers/InventoryHelper';
import { ast22AuthScheme } from 'Helpers/Ast22Helper';
import { ITEM_TYPE_NAMES } from 'Data/itemTypes';

/**
 * MainStore - главное хранилище приложения bxDash
 * Управляет бэкенд-системами (Bitrix, Zabbix, Inventory) и общими данными
 */
class MainStore {

	// === Ссылки на другие хранилища — НЕ observable ===
	bx;           // BackendSystem для Bitrix
	zabbix;       // BackendSystem для Zabbix
	inventory;    // BackendSystem для Inventory
	ast22;        // BackendSystem для ast22-phones (телефония)

	// === Свойства, которые НЕ должны быть observable ===
	cookies = new Cookies(null, { path: '/' });  // Работа с cookies

	// === Observable свойства ===
	/** Список типов элементов дашборда (источник — реестр Data/itemTypes) */
	itemsTypes = ITEM_TYPE_NAMES;
	/** Список пользователей битрикса для выбора автора заявки */
	bxUsersList = [];

	/** Создаёт обязательные системы и телефонию, если она разрешена конфигурацией. */
	constructor({ asteriskEnabled = true } = {}) {
		// Инициализация бэкенд-систем
		this.bx = new BackendSystem('Bitrix', bxAuthScheme);
		this.zabbix = new BackendSystem('Zabbix', zabbixAuthScheme);
		this.inventory = new BackendSystem('Inventory', inventoryAuthScheme);
		this.ast22 = asteriskEnabled ? new BackendSystem('Ast22', ast22AuthScheme) : null;

		// Явное объявление реактивных свойств (стандарт MobX проекта)
		makeObservable(this, {
			// Observable свойства
			itemsTypes: observable,
			bxUsersList: observable,
			// Computed свойства
			hasErrors: computed,
		});
	}

    loadOption(name) {
		return this.cookies.get(name);
	}

	saveOption(name,value) {
		//console.log('saving '+value+' -> '+name)
		return this.cookies.set(name,value,);
	}
    
    setInventoryUrl(url) {
		this.inventory.setUrl(url);
    }

    setBxUrl(url) {
        this.bx.setUrl(url);
    }

    setAsteriskUrl(url) {
        this.ast22?.setUrl(url);
    }

	setZabbixUrl(url) {
        this.zabbix.setUrl(url);
    }

	get hasErrors() {
    return [
		this.bx.availability,
		this.bx.authStatus,
		this.zabbix.availability,
		this.zabbix.authStatus,
		this.inventory.availability,
		this.inventory.authStatus,
    ].some(status => status !== 'OK');
  }

	async authenticate(user,password,onSuccess,onFail){
		this.bx.setLoginCredentials(user,password);
		this.zabbix.setLoginCredentials(user,password);
		this.inventory.setLoginCredentials(user,password);
		// Отключённая телефония не участвует в авторизации и не запускает запросов.
		this.ast22?.setLoginCredentials(user,password);
		when (()=>this.bx.authStatus!=='Pending' && this.zabbix.authStatus!=='Pending' && this.inventory.authStatus!=='Pending',()=>{
			if (this.bx.authStatus==='OK' && this.zabbix.authStatus==='OK' && this.inventory.authStatus==='OK') {
				if (onSuccess) onSuccess();
			} else {
				if (onFail) onFail();
			}
		});
	}

	/**
	 * Загружает список активных пользователей битрикса для выбора автора заявки
	 * @returns {Promise<Array>} Массив пользователей {id, name, login, email}
	 */
	async fetchBxUsersList() {
		try {
			const response = await this.bx.fetch('user/list');
			if (!response.ok) {
				console.error('Failed to fetch users list:', response.status);
				return [];
			}
			const users = await response.json();
			runInAction(() => {
				this.bxUsersList = users;
			});
			return users;
		} catch (error) {
			console.error('Error fetching users list:', error);
			return [];
		}
	}
}

export default MainStore;
