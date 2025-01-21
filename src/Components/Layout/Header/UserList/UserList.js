import React from "react";
import {observer} from "mobx-react";
import { get} from "mobx"

import './UserList.css';
import UserItem from "./UserItem";
import { StoreContext } from "Data/Stores/StoreProvider";


@observer class UserList extends React.Component {
    render() {
        const usersStore = this.context.users;

        //console.log(userStore.items);
        //console.log('UserList.render');
        if (!usersStore.order.length) return (
            <div>No users loaded</div>
        );
        //console.log(usersStore)
        return (
            <div className="AppUserList">
                <div className="PeriodTitle">&nbsp;</div>
                <div className="PeriodData Row">
                    <table className="UserCells">
                        <tbody>
                            <tr>
                                {usersStore.order.map((i,index) => {
									const user=get(usersStore.items,i);
                                    if(usersStore.selected===user.id || usersStore.selected===null) 
                                        return (<UserItem key={user.id} id={user.id} index={index}/>);
									return null;
                                })}
                            </tr>
                        </tbody>
                    </table>

                </div>
				<div className="dummyScrollBar" style={{width:this.context.layout.scrollbarWidth}}>&nbsp;</div>
            </div>
        )
    }
}
UserList.contextType=StoreContext;

export default UserList;