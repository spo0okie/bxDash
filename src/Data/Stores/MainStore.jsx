import {action, makeAutoObservable, when, observable, runInAction} from 'mobx';
import Cookies from 'universal-cookie';
import BackendSystem from './BackendSystem';
import { bxAuthScheme } from 'Helpers/BxHelper';
import { zabbixAuthScheme } from 'Helpers/ZabbixHelper';
import { inventoryAuthScheme } from 'Helpers/InventoryHelper';

class MainStore {

    constructor() {
		this.bx=new BackendSystem('Bitrix',	bxAuthScheme);
		this.zabbix=new BackendSystem('Zabbix', zabbixAuthScheme);
		this.inventory=new BackendSystem('Inventory', inventoryAuthScheme);
		this.bxUsersList = [];  // Список пользователей битрикса для выбора автора заявки
        makeAutoObservable(this)
    }

	itemsTypes = ['task', 'ticket', 'job', 'plan', 'memo','absent'];

	cookies= new Cookies(null, { path: '/' });

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
        //this.asteriskUrl=url; 
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