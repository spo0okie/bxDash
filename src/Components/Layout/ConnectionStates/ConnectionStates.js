import { useContext, useState } from 'react';
import { observer } from 'mobx-react-lite';
import './ConnectionStates.css';
import { StoreContext } from 'Data/Stores/StoreProvider';

const statusItem=function(status) {
	let style='';
	switch (status) {
		case 'OK': style='green'; break;
		case 'Pending': style='yellow'; break;
		default: style='red'
	}
	return <span className={style}>{status}</span>
}

const ConnectionStates = observer(function InvAuthForm() {
    const context = useContext(StoreContext);

    const wsConnectionStatus = context.ws.connectionStatus; // Получение статуса WebSocket


    return (
        <table className="ConnectionStates">
			<thead>
				<tr>
					<th>Backend</th>
					<th>Avail</th>
					<th>Auth</th>
					<th>ID</th>
				</tr>

			</thead>
			<tbody>
				<tr>
					<td>Подключение WS channel</td>
					<td className='status'>{statusItem(wsConnectionStatus)}</td>
					<td className='status'>{statusItem(wsConnectionStatus)}</td>
					<td className='id'>{context.ws.id}</td>
				</tr>
				<tr>
					<td>Подключение Bitrix</td>
					<td className='status'>{statusItem(context.main.bx.availability)}</td>
					<td className='status'>{statusItem(context.main.bx.authStatus)}</td>
					<td className='id'>{context.main.bx.userId}</td>
				</tr>
				<tr>
					<td>Подключение Zabbix</td>
					<td className='status'>{statusItem(context.main.zabbix.availability)}</td>
					<td className='status'>{statusItem(context.main.zabbix.authStatus)}</td>
					<td className='id'>{context.main.zabbix.userId}</td>
				</tr>
				<tr>
					<td>Подключение Inventory</td>
					<td className='status'>{statusItem(context.main.inventory.availability)}</td>
					<td className='status'>{statusItem(context.main.inventory.authStatus)}</td>
					<td className='id'>{context.main.inventory.userId}</td>
				</tr>

			</tbody>
		</table>
    );
});

export default ConnectionStates;