import 'reflect-metadata';
import {observable, when, makeAutoObservable, runInAction , get, set, action, computed, keys, has} from 'mobx';
import UserItem from 'Data/Items/UserItem';

class UsersStore {
    main;

    loadOption(name) {return this.main.loadOption('users.'+name);}
    saveOption(name,value) {return this.main.saveOption('users.'+name,value,);}

    constructor(main) {
        this.main=main;
        this.selected=this.loadOption('selected')??null;
        makeAutoObservable(this)
    }

    @observable hovered = null;             //над каким пользователем (колонкой) сейчас мышь
    @observable selected = null;            //каким пользователем ограничено отображение
    @observable items = observable.map();

	@observable dutyPhone=null;
	@observable dutyTicketLogin=null;

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
        });
    }

	//создать/обновить элемент из другого JS объекта
    initItem(data){
		const id = Number(data.id);		
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

    @computed getUser(id) {
        return get(this.items,id);
    }

    @action setItem(item) {

        set(this.items, item.id, item);        
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
			console.log('No user '+uid+' in this dashboard');
			console.log(keys(this.items));
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

}

export default UsersStore;