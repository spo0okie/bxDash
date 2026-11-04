import 'reflect-metadata';
import {observable, when, makeObservable, get, set, action, has, remove, observe} from 'mobx';

class AlertsStore {
    items = new observable.map([],{deep:true});
	type = 'alert';
	isLoading=true;		//пока ничего не загрузили, считаем что еще загружаем

	master;
    periods;
    time;
    users;
    main;
	ws;

	service = observable.map(); // Changed to observable.map
    support = observable.map(); // Changed to observable.map

	// Состояние фиксации тултипа: { username, type, severity } или null
	pinnedAlertGroup = null;

	constructor(main) {
		this.main=main;
		this.loadItems();
		makeObservable(this, {
			isLoading: observable,
			setLoading: action,
			loadItems: action,
			pinnedAlertGroup: observable,
			setPinnedAlertGroup: action,
		});
	}


	setLoading(value) {
		this.isLoading=value;
	}

	/**
	 * Устанавливает/сбрасывает фиксацию группы алертов
	 * @param {Object|null} group - { username, type, severity } или null для сброса
	 */
	setPinnedAlertGroup(group) {
		this.pinnedAlertGroup = group;
	}

    //загрузить алерты заббикс
    loadItems() {
		console.log('loading ' + this.type + 's');
		const request={
			// clock — время возникновения проблемы в Unix-секундах.
			output: ['eventid','objectid','name','severity','clock'],
      		//value: 1,
			source: 0,
			"tags": [
				{tag:"serviceman",operator:4},
				{tag:"supportteam",operator:4},
				{tag:"node-service",operator:4},
				{tag:"node-support",operator:4}
			],
			suppressed: false,
			evaltype:2,
      		selectTags: 'extend',
			sortfield: 'eventid',
			sortorder: 'DESC',	//при упоре в limit теряем старые события, а не свежие
			limit:2000,
		};

		this.setLoading(true);
		when(()=>this.main.zabbix.authStatus==='OK',()=>{
			this.main.zabbix.fetch('api_jsonrpc.php',{body:JSON.stringify({jsonrpc: '2.0', method: 'problem.get', params: request, id: 1})})
			.then((response) => response.json())
			.then((data) => {
				//console.log(data);

				const triggerIds = new Set();
				data.result.forEach(event => {
					triggerIds.add(event.objectid);
				});

				const triggerRequest = {
					output: ['triggerid','status','state','value'],
					triggerids: Array.from(triggerIds),
					selectHosts: ['hostid','name','status'],
					skipDependent: true,
				};

				this.main.zabbix.fetch('api_jsonrpc.php', { body: JSON.stringify({ jsonrpc: '2.0', method: 'trigger.get', params: triggerRequest, id: 2 }) })
					.then((response) => response.json())
					.then((triggerData) => {
						const triggerMap = new Map();
						triggerData.result.forEach(trigger => {
							triggerMap.set(trigger.triggerid, trigger);
						});

						// Events that passed all the filtering checks — only these must stay in storage
						const activeEventIds = new Set();

						// Process events and update storage
						data.result.forEach(event => {
							const trigger = triggerMap.get(event.objectid);
							if (trigger) {
								event.trigger=trigger;
								if(trigger.hosts && trigger.hosts.length > 0) {
									if (trigger.hosts[0].status === '1') return; //unmonitored host
									event.host = trigger.hosts[0].name; // Add host attribute
								}

								if (trigger.status === '1') return; // Skip if trigger is not enabled
								if (trigger.state === '1') return; // Skip if trigger is unknown state
								if (trigger.value !== '1') return; // Skip if trigger is not problem
							} else return;

							activeEventIds.add(event.eventid);

							const servicemanTag = event.tags.find(tag => tag.tag === 'serviceman');
							const nodeServiceTag = event.tags.find(tag => tag.tag === 'node-service');
							const supportTeamTag = event.tags.find(tag => tag.tag === 'supportteam');
							const nodeSupportTag = event.tags.find(tag => tag.tag === 'node-support');

							const serviceKeys = servicemanTag ?
								(servicemanTag.value ? servicemanTag.value.split(/[\s,]+/) : []):
								(nodeServiceTag?.value ? nodeServiceTag.value.split(/[\s,]+/) : []);
							const supportKeys = supportTeamTag ?
								(supportTeamTag.value ? supportTeamTag.value.split(/[\s,]+/) : []):
								(nodeSupportTag?.value ? nodeSupportTag.value.split(/[\s,]+/) : []);

							serviceKeys.forEach(serviceKey => {
								if (serviceKey) {
									//console.log(event);
									if (!this.service.has(serviceKey)) {
										this.service.set(serviceKey, new Map());
									}
									const serviceMap = this.service.get(serviceKey);
									if (!serviceMap.has(event.eventid)) {
										serviceMap.set(event.eventid, event);
									}
								}
							});

							supportKeys.forEach(supportKey => {
								if (supportKey) {
									if (!this.support.has(supportKey)) {
										this.support.set(supportKey, new Map());
									}
									const supportMap = this.support.get(supportKey);
									if (!supportMap.has(event.eventid)) {
										supportMap.set(event.eventid, event);
									}
								}
							});
						});

						// Remove closed problems from service storage
						this.service.forEach((serviceMap, serviceKey) => {
							serviceMap.forEach((_, eventId) => {
								if (!activeEventIds.has(eventId)) {
									serviceMap.delete(eventId);
								}
							});
							if (serviceMap.size === 0) {
								this.service.delete(serviceKey);
							}
						});

						// Remove closed problems from support storage
						this.support.forEach((supportMap, supportKey) => {
							supportMap.forEach((_, eventId) => {
								if (!activeEventIds.has(eventId)) {
									supportMap.delete(eventId);
								}
							});
							if (supportMap.size === 0) {
								this.support.delete(supportKey);
							}
						});

						this.setLoading(false);
						//console.log(this.service);
					})
					.catch(error => {
						console.error(error);
						this.setLoading(false);
					});
			})
			.catch(error=>{
				console.error(error);
				this.setLoading(false);
			});
		})
		setTimeout(()=>this.loadItems(),15000);
    }

}

export default AlertsStore;
