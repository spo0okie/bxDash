import React from "react";
import {observer} from "mobx-react";
import {get} from 'mobx';
import { StoreContext } from "../../Stores/StoreProvider";
import './UserItem.css';
import classNames from "classnames";
import { ReadyState } from "react-use-websocket";


export const WsStatus = (props)=> {
  	//Public API that will echo messages sent to it back to the client
	const onMessage=(message)=>{
		console.log(message);
	}
	//const { sendMessage, readyState } = useWebSocket(props.url,{onMessage:onMessage});

	

        const usersStore = this.context.users;
        const id = this.props.id;
        const user = get(usersStore.items,id);
        return (
            <div 
                style={{ width: 100/usersStore.count()+'%' }}
                className={classNames(
					"WsStatusLamp",
					{'Connecting':[ReadyState.CONNECTING]},
					{'Open':[ReadyState.OPEN]},
					{'Closing':[ReadyState.CLOSING]},
					{'Closed':[ReadyState.CLOSED]},
					{'Uninstantiated':[ReadyState.UNINSTANTIATED]},
				)}
            />
        )
}
WsStatus.contextType=StoreContext;

export default WsStatus;