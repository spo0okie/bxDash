import 'reflect-metadata';
import {observable, when, makeAutoObservable, runInAction , get, set, action, computed, keys, has, observe} from 'mobx';
import UserItem from 'Data/Items/UserItem';

const STATE_PRIORITY = {
    50: "RINGING",
    40: "INUSE",
    30: "IDLE",
    20: "UNAVAILABLE",
    10: "UNKNOWN",
};
const STATE_PRIORITY_REVERSE = {
    "RINGING": 50,
    "INUSE": 40,
    "IDLE": 30,
    "UNAVAILABLE": 20,
    "UNKNOWN": 10,
};

class UsersStore {
    main;

    loadOption(name) {return this.main.loadOption('users.'+name);}
    saveOption(name,value) {return this.main.saveOption('users.'+name,value,);}

    @observable hovered = null;             //над каким пользователем (колонкой) сейчас мышь
    @observable selected = null;            //каким пользователем ограничено отображение
    @observable items = observable.map();
	@observable order=[];
	@observable initialized=false;
	@observable current = null;

	@observable dutyPhone=null;
	@observable dutyTicketer=null;
	allPhones=[];	//все телефоны всех пользователей

    async loadUser(item) {
        //console.log(mainStore)
        const store=this;
        when(()=>this.main.inventoryAuth,()=>{
            this.main.inventory.get('users','search',{'login':item},function(data){
                if (data.Ename) {
                    item.name = data.Ename.split(' ')[0];
                    item.phone = data.Phone;
                    runInAction(()=>{store.updateUser(item)});
                    //console.log(data);
                } else {
                    console.log(data);
                }    
            })
        })
    }
	
	/**
	 * Контекст для элементов
	 * @returns 
	 */
	getContext(){
		return {
			time: this.time,
			main: this.main,
			items: this,
			users: this,
			periods: this.periods,
		};
	}

	

    @action init(items){
        this.items = observable.map();
        Object.keys(items).forEach((id) => {
			const item=items[id];
			item.id=Number(id);
            this.initItem(item);
			if (item.roles.includes('user') && !this.order.includes(item.id)) this.order.push(item.id);	//добавляем в порядок элементов недостающие
        });
		for(let i=this.order.length-1; i>=0; i--) {
			if (!has(this.items,this.order[i])) {
				this.order.splice(i);		//убираем лишние
			} else if (!get(this.items,this.order[i]).roles.includes('user')) {
				//console.log(get(this.items,this.order[i]).roles);
				this.order.splice(i);		//убираем лишние
			}
		}
		console.log(this.order);
		this.initialized=true;
    }

	@action setCurrent(value) {
		console.log(value);
		when (()=>this.initialized,()=>{
			console.log(value);
			if (has(this.items,value)) {
				console.log('current user is '+value);
				this.current=value;
			}
		});
	}

	//создать/обновить элемент из другого JS объекта
    initItem(data){
		const id = Number(data.id);		
		data.realPhones = [data.phone, ...(data.additionalPhones ?? [])];	// все телефоны в одном массиве
        this.allPhones.push(...data.realPhones);

		console.log(data);
        if (!has(this.items,id)) {
			//console.log('creating new '+ this.type);
			const Item = new UserItem(data, {}, this);
			this.setItem(Item);
        } else {
			//console.log('updating '+id);
			const Item = get(this.items, id)
			Item.init(data);			
        }
        //console.log(this.tasks[id]);
    }    


    @computed count() {
        return keys(this.items).length;
    }

    @action setItem(item) {
        set(this.items, item.id, item);        
    }

	@computed isAdmin() {
		if (!this.current) return false;
		return get(this.items,this.current).roles.includes('admin');
	}

    /**
     * Обновляет объект item  
     */
    @action updateItem(item) {
		if (has(this.items, item.id)) {
			//console.log(get(this.items, item.id));
			//если такой элемент есть - обновляем его поля (поштучно)
			Object.keys(item).forEach((key) => {
				console.log('Updating ' + this.type + ' ' + item.id + ': ' + key + ' => ' + item[key]);
				get(this.items, item.id)[key] = item[key];
			});
		} else {
			//иначе просто создаем новый
			this.setItem(item);
		}

	}

	updateConnection(connection) {
		//console.log(connection);
		const uid=Number(connection.userId);
		if (has(this.items, uid)) {
			//console.log(get(this.items, uid));
			//если такой элемент есть - обновляем его поля (поштучно)
			get(this.items, uid).updateConnection(connection);
		} else {
			//console.log('No user '+uid+' in this dashboard');
			//console.log(keys(this.items));
		}
	}

    @action setHover(id) {
        //console.log(id);
        this.hovered=id;
    }

    @action setSelect(id) {
        console.log(id);
        this.selected=id;
        this.saveOption('selected',id);
    }

	@action setDutyTicketer(id) {        
		if (this.dutyTicketer===id) return;
		this.dutyTicketer=id;
	}

	@action setDutyPhone(id) {        
		if (this.dutyPhone===id) return;
		this.dutyPhone=id;
	}

	@action setOrder(value) {
		this.order=value;
		this.saveOption('order',value);
	}

    /**
     * Обновляет статус телефона пользователя по номеру телефона
     * @param {string} phone
     * @param {string} status
     */
    updatePhoneStatus(phone, status) {
        // Найти пользователя, у которого есть этот телефон
		phone = Number(phone);
        let user = null, idx = -1;
        for (const id of keys(this.items)) {
            const item = get(this.items, id);
			//console.log(item);
            if (item.realPhones && Array.isArray(item.realPhones)) {
                const i = item.realPhones.indexOf(phone);
				//console.log(phone, item.realPhones,i);
                if (i !== -1) {
                    user = item;
                    idx = i;
                    break;
                }
            }
        }
        if (!user || idx === -1) return;

        // Ensure realPhonesStatuses exists
        if (!user.realPhonesStatuses) user.realPhonesStatuses = [];

        // Обновить статус телефона
        user.realPhonesStatuses[idx] = status;

        // Пересчитать phoneStatus
        let maxPriority = 0;
        let maxState = "UNKNOWN";
        for (let s of user.realPhonesStatuses) {
            const prio = STATE_PRIORITY_REVERSE[s] ?? 10;
            if (prio > maxPriority) {
                maxPriority = prio;
                maxState = s;
            }
        }
        if (user.phoneStatus !== maxState) {
            user.setPhoneStatus(maxState);
        }
    }

    constructor(main) {
        this.main=main;
        this.selected=this.loadOption('selected')??null;
		this.order=this.loadOption('order')??[];
        makeAutoObservable(this);
		this.setCurrent(this.main.bx.userId);
		observe(this.main.bx,'userId',change=>{this.setCurrent(this.main.bx.userId)});
    }
	
}

export default UsersStore;