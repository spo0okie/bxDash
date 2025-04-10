import {get, has, keys, values} from 'mobx';
import { observer } from 'mobx-react';
import React, { useContext} from 'react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import './UserAlerts.css';
import { Tooltip } from 'antd';

const AlertListButton = ({severity,list}) => {
    const { main } = useContext(StoreContext);
	return (list.length>0)&&<Tooltip title={
		<ul className="user-alerts">
			{list.map((item)=>{
				const trigerid=get(item,'objectid');
				const eventid=get(item,'eventid');
				const name=get(item,'host')+': '+get(item,'name');
				return <li>
						<a 
							href={main.zabbix.baseUrl+"tr_events.php?triggerid="+trigerid+"&eventid="+eventid} 
							target='_blank' 
							rel="noreferrer" 
							onClick={(e) => e.stopPropagation()} // Prevent event bubbling
						>
							{name}
						</a>
					</li>
			})}
		</ul>} overlayInnerStyle={{maxWidth: '500px'}}>
		<span className={'severity'+severity+' item'}>
			{list.length}
		</span>
	</Tooltip>
}


const UserAlerts = observer((props) => {
    const { alerts } = useContext(StoreContext);
    const serviceAlerts = get(alerts.service,props.username);
    const supportAlerts = get(alerts.support,props.username);

    const priorityLabels = [1, 2, 3, 4, 5];

	//console.log(triggers);

	let serviceCounts = [];
	let supportCounts = [];
	priorityLabels.forEach((priority) => {
		let service=0;
		let support=0;
		let serviceList=[];
		let supportList=[];
		if (serviceAlerts) keys(serviceAlerts).forEach(key => {
			const alert=get(serviceAlerts,key);
			if (Number(get(alert,'severity'))===priority) {
				service++;
				serviceList.push(alert);
			}
		});	
		if (supportAlerts) keys(supportAlerts).forEach(key => {
			const alert=get(supportAlerts,key);
			if (Number(get(alert,'severity'))===priority) {
				support++;
				supportList.push(alert);
			}
		});	
        serviceCounts.push({priority,count:service,list:serviceList});
		supportCounts.push({priority,count:support,list:supportList});
    });

	//console.log(serviceCounts);
    return (<>
        <div className="user-alerts service">
			{serviceCounts.map(({ priority, list }) => <AlertListButton list={list} severity={priority}/>)}
        </div>
        <div className="user-alerts support">
			{supportCounts.map(({ priority, list }) => <AlertListButton list={list} severity={priority}/>)}
		</div>
	</>);
});

export default UserAlerts;