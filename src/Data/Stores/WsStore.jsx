import TimeHelper from "Helpers/TimeHelper";
import { observable, action, makeAutoObservable, when, values } from "mobx";

//https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
export class WsStore {
	main;
	items;
	users;
	socket;
	url;
	
	@observable id=null;
	@observable connectionStatus = "disconnected"; // статус соединения: 'connected', 'disconnected', 'connecting'
	activityTimestamp=0;	//отметка последнего оповещения об активности
	intervals = [];

	@action setConnectionStatus(status) {
        this.connectionStatus = status;
    }

	@action setId(id) {
        this.id = id;
    }
  
onMessage=(message)=>{
		try {
			const data=JSON.parse(message.data);

			switch (data.event) {
				case 'wsConnected':
					this.setId(Number(data.connection));
					//$globDashConnections[0].id=$globWsId;
					console.log('WS Connection ID set to '+this.id);
					break;
				case 'taskUpdate':
					if (this.items && this.items['task']) {
						this.items['task'].loadItem(Number(data.taskId));
					}
					break;
				case 'jobUpdate':
					if (this.items && this.items['job']) {
						this.items['job'].loadItem(Number(data.jobId));
					}
					break;
				case 'planUpdate':
					if (this.items && this.items['plan']) {
						this.items['plan'].loadItem(Number(data.id));
					}
					break;
				case 'ticketUpdate':
					if (this.items && this.items['ticket']) {
						this.items['ticket'].loadItem(Number(data.ticketId));
					}
					break;
				case 'ping':
					//console.log(this.users);
					if (this.users) {
						this.users.updateConnection(data.connection);
					}
					break;
				case 'techSupportTicketer':
					if (this.users) {
						this.users.setDutyTicketer(data.user);
					}
					break;
				case 'techSupportShift':
					if (this.users) {
						this.users.setDutyPhone(data.phone);
					}
					break;
				case 'phonesStatusUpdate':
					// data.data: { phone1: state1, phone2: state2, ... }
					if (this.users && data.data) {
						Object.entries(data.data).forEach(([phone, state]) => {
							this.users.updatePhoneStatus(phone, state);
						});
					}
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
		} catch (error) {
			console.error('Error parsing WebSocket message:', error);
		}
	}
	
	activityUpdate() {
		this.activityTimestamp=TimeHelper.getTimestamp();
	}

	ping() {
		if (!this.main.bx.userId) {
			console.log('cant ping without user ID');
			//console.log(this.main);
			return;
		}
		const connection={
			id:this.id,
			userId:this.main.bx.userId,
			login:this.main.bx.login,
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
		console.log('sending');
		console.log(data);
		if (this.connectionStatus !== 'OK') {
			console.log('cant send message, connection status is '+this.connectionStatus);
			return;
		}
		try {
			this.socket.send(JSON.stringify(data));
		} catch (error) {
			console.error('Error sending WebSocket message:', error);
		}
	}

connect(url) {
        this.url = url;
        this.setConnectionStatus("Pending");
        this.socket = new WebSocket(url);

        this.socket.addEventListener("open", () => {
            this.setConnectionStatus("OK");
            console.log("WebSocket connected");
        });

        this.socket.addEventListener("close", () => {
            this.setConnectionStatus("Disconnected");
            console.log("WebSocket disconnected");
        });

        this.socket.addEventListener("message", this.onMessage);

        this.socket.addEventListener("error", (error) => {
            console.error("WebSocket error:", error);
            this.setConnectionStatus("Disconnected");
        });

		// Отправить запрос на получение статусов телефонов
        when(()=>this.connectionStatus === 'OK',()=>{this.sendMessage({
            action: 'getPhonesStates',
            numbers: values(this.users ? this.users.allPhones : [])
        })});
    }

	checkConnection() {
        if (this.connectionStatus === "Disconnected") {
            console.log("Reconnecting WebSocket...");
            this.connect(this.url); // Переподключение
        }
    }

constructor(url, main, users, items) {
        makeAutoObservable(this); // Автоматическое создание наблюдаемых свойств и действий
        console.log("connecting " + url);
        this.main = main;
        this.items = items;
        items.ws = this;
        this.users = users;
        this.connect(url);

        // Собрать все телефоны из realPhones всех пользователей
        const pingInterval = setInterval(() => this.ping(), 10000);
        const checkConnectionInterval = setInterval(() => this.checkConnection(), 15000); // Проверка соединения каждые 15 секунд
        this.intervals.push(pingInterval, checkConnectionInterval);
    }

    clearIntervals() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    destroy() {
        this.clearIntervals();
        if (this.socket) {
            this.socket.close();
        }
    }
};