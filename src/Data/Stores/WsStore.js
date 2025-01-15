import TimeHelper from "Helpers/TimeHelper";

//https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
export class WsStore {
	main;
	items;
	users;
	socket;
	
	id=null;

	activityTimestamp=0;	//отметка последнего оповещения об активности
  
	onMessage=(message)=>{
		const data=JSON.parse(message.data)

		switch (data.event) {
            case 'wsConnected':
                this.id=Number(data.connection);
                //$globDashConnections[0].id=$globWsId;
                console.log('WS Connection ID set to '+this.id);
                break;
			case 'taskUpdate':
				this.items['task'].loadItem(Number(data.taskId));
				break;
			case 'jobUpdate':
				this.items['job'].loadItem(Number(data.jobId));
				break;
			case 'planUpdate':
				this.items['plan'].loadItem(Number(data.id));
				break;
            case 'ticketUpdate':
				this.items['ticket'].loadItem(Number(data.ticketId));
                break;
			case 'ping':
				//console.log(this.users);
				this.users.updateConnection(data.connection);
				break;
			case 'techSupportTicketer':
				this.users.setDutyTicketer(data.user);
				break;
			case 'techSupportShift':
				this.users.setDutyPhone(data.phone);
				break;
						/*
            case 'jobRemove':
                userJobRemove(data.jobId);
                break;
            case 'techSupportShift':
                userPhonesSetDuty(data.phone);
                break;*/
            default:
                console.log('Unknown event');
                console.log(data);

        }
		
	}
	
	activityUpdate() {
		this.activityTimestamp=TimeHelper.getTimestamp();
	}

	ping() {
		if (!this.main.bxUserId) {
			console.log('cant ping without user ID');
			console.log(this.main);
			return;
		}
		const connection={
			id:this.id,
			userId:this.main.bxUserId,
			login:this.main.bxLogin,
			activityTimestamp:this.activityTimestamp,
			pingTimestamp:TimeHelper.getTimestamp()
		}
		const message={
			event:'ping',
			connection:connection
		}
		this.sendMessage(message);
		this.users.updateConnection(connection);
	}

	sendMessage=(data)=>{
		//console.log('sending');
		//console.log(data);
		this.socket.send(JSON.stringify(data));
	}

	constructor (url,main,users,items) {
		console.log('connecting '+url);
		this.main=main;
		this.items=items;
		items.ws=this;
		this.users=users;
    	this.socket = new WebSocket(url);
    	this.socket.addEventListener('message',this.onMessage);
		setInterval(()=>this.ping(),10000);
	}
};