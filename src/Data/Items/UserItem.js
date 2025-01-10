import TimeHelper from "Helpers/TimeHelper";
import DashItem from "./DashItem";
import { observable, keys, action, makeObservable, get, has} from 'mobx';

class UserItem extends DashItem {
	text;
	activityTimestamp;
	connectionTimestamp;
	activityStatus;

	initDefaults() {
		this.type = 'user';		//тип
		this.confirmMove = false;
		this.activityTimestamp=0;
		this.connectionTimestamp=0;
		this.activityStatus='offline';
		this.t=0;
		setInterval(() => {
			this.recalcTime();
		}, 5*1000);
	}

	isDraggable(cell) {
		return true;		
	}

	recalcTime() {
		const disconnectTimeout=1000*60*5;
		const unavailTimeout=1000*60*7;
		const awayTimeout=1000*90;
		if (this.activityTimestamp===0) return;
		if (this.connectionTimestamp===0) return;
		
		const cTimeout=TimeHelper.getTimestamp()-this.connectionTimestamp;
		if (cTimeout>disconnectTimeout) {
			this.setStatus('offline');
			return;
		}
		const aTimeout=TimeHelper.getTimestamp()-this.activityTimestamp;
		
		if (aTimeout>unavailTimeout) {
			this.setStatus('unavail');
			return;
		}

		if (aTimeout>awayTimeout) {
			this.setStatus('away');
			return;
		}

		this.setStatus('online');
	}

	setStatus(value) {
		if (value===this.activityStatus) return;
		this.activityStatus=value;
	}	
	
	/**
	 * Инициализация
	 * @param {*} item 
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item){
	}


	/**{ 
​​		activityTimestamp: 1736420879493
​​		id: 317915
​​		login: "nesmachnyj.v"
​​		pingTimestamp: 1736420879493
​​		userId: 4255 
	}*/
	updateConnection(connection) {
		this.connectionTimestamp=Math.max(this.connectionTimestamp,connection.pingTimestamp,TimeHelper.getTimestamp());
		this.activityTimestamp=Math.max(this.activityTimestamp,connection.activityTimestamp);
		//console.log(this);
		this.recalcTime();
	}


	constructor(item,data,list) {
			super(item,data,list);
	
			makeObservable(this,{
				activityStatus:observable,
				setStatus:action,
			})
	
			//console.log(this);
		}

}
export default UserItem;