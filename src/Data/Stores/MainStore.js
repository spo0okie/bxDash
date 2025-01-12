//import 'reflect-metadata';
import Inventory from 'Helpers/Inventory';
import {observable, action, makeAutoObservable} from 'mobx';
import Cookies from 'universal-cookie';

class MainStore {

    constructor() {
        makeAutoObservable(this)
    }

    @observable inventoryAuth=false;         //признак успешной авторизации
    @observable bxAuth=false;         //признак успешной авторизации

    inventoryUrl;
    apiUrl;
    wsUrl;
    asteriskUrl;
	bxUserId=null;
	bxLogin=null;


	itemsTypes = ['task', 'ticket', 'job', 'plan', 'memo','absent'];

    
    inventory=new Inventory();
    cookies= new Cookies(null, { path: '/' });

    loadOption(name) {return this.cookies.get(name);}
    saveOption(name,value) {return this.cookies.set(name,value,);}
    
    setInventoryUrl(url) {
        this.inventoryUrl=url;
        this.inventory.baseUrl=url;
    }

    setApiUrl(url) {
        this.apiUrl=url;
    }

    setWsUrl(url) {
        this.wsUrl=url;
    }

    setAsteriskUrl(url) {
        this.asteriskUrl=url; 
    }


    @action setInventoryAuth(value) {
        this.inventoryAuth=value;
        console.log('inventoryAuth updated');
    }

	@action setBxAuth(value) {
        this.bxAuth=value;
        console.log('bxAuth updated');
    }

        
    authenticateInventory(user,password,success,fail){
        this.inventory.authorize(
            user,
            password,
            ()=>{
                this.setInventoryAuth(true);
                success();
            },
            ()=>{
                fail();
            }
        );
    }


	init(){
		fetch(this.apiUrl + 'user/get')
			.then((response) => response.json())
			.then((data) => {
			if (data.auth !== undefined && data.auth) {
				this.setBxAuth(true);
				this.bxUserId=Number(data.id);
				this.bxLogin=data.login;
			} else {
				this.setBxAuth(false);
				this.bxUserId=null;
				this.bxLogin=null;
				console.log(data);					
			} 
		})
		.catch((error) => {
			console.log(error)
		});
	}


	authenticateBx(user,password,onSuccess,onFail){
		fetch(this.apiUrl + 'user/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user:user,
				password:password
			})
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.auth !== undefined && data.auth) {
					this.setBxAuth(true);
					this.bxUserId=Number(data.id);
					this.bxLogin=data.login;
						if (onSuccess !== undefined && onSuccess !== null) onSuccess();
				} else {
					this.setBxAuth(false);
					this.bxUserId=null;
					this.bxLogin=null;
						if (onFail !== undefined && onFail !== null) onFail();
					console.log(data);					
				} 
			})
			.catch((error) => {
				if (onFail !== undefined && onFail !== null) onFail();
				console.log(error)
			});
	}
}

export default MainStore;