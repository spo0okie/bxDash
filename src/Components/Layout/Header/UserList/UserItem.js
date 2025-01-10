import React from "react";
import {observer} from "mobx-react";
import {get} from 'mobx';
import { StoreContext } from "Data/Stores/StoreProvider";
import './UserItem.css';
import classNames from "classnames";


@observer class UserItem extends React.Component {
    mouseIn = () => {
        this.context.users.setHover(this.props.id);
    };

    mouseOut = () => {
        this.context.users.setHover(null);
    };

    toggleUser = () => {
        const layout=this.context.layout;
        const users=this.context.users;

        if (users.selected===null) {
            users.setSelect(this.props.id);
            //layout.setMode(layout.expand?layout.LAYOUT_PERSONAL_DAYS:layout.LAYOUT_PERSONAL_WEEKS)
        } else {
            users.setSelect(null);
            //layout.setMode(layout.LAYOUT_DEFAULT);
        }

    }

    render() {
        const usersStore = this.context.users;
        const id = this.props.id;
        const user = get(usersStore.items,id);
        return (
            <td 
                style={{ width: 100/usersStore.count()+'%' }}
                className={classNames(
					'UserItem',
					'clickable',
					{'hovered':id===usersStore.hovered}
				)}
                onMouseOver={this.mouseIn}
                onMouseOut={this.mouseOut}
                onClick={this.toggleUser}
                >
					<span className={classNames(
						'userStatus',user.activityStatus
					)}></span>
                {user.name} ({user.phone})
            </td>
        )
    }
}
UserItem.contextType=StoreContext;

export default UserItem;