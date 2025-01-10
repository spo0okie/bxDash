import React from "react";
import {observer, inject} from "mobx-react";
import {keys} from "mobx"

import './UserList.css';
import UserItem from "./UserItem";
import { StoreContext } from "Data/Stores/StoreProvider";


@observer class UserList extends React.Component {
    render() {
        const usersStore = this.context.users;

        //console.log(userStore.items);
        console.log('UserList.render');
        if (!usersStore.items.size) return (
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
                                {keys(usersStore.items).map((i) => {
                                    if(usersStore.selected===i || usersStore.selected===null) 
                                        return (<UserItem key={i} id={i} />)
                                })}
                            </tr>
                        </tbody>
                    </table>

                </div>
            </div>
        )
    }
}
UserList.contextType=StoreContext;

export default UserList;