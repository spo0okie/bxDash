import React from "react";
import {observer} from "mobx-react";

import './UserList.css';
import UserItem from "./UserItem";
import { StoreContext } from "Data/Stores/StoreProvider";


/** Показывает пользователей в порядке общей доски во всех раскладках. */
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
								{usersStore.order.map(id => (
									<UserItem key={id} id={id} />
								))}
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
