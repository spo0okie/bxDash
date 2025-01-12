import React from "react";
import {observer} from "mobx-react";
import {get} from 'mobx';
import { StoreContext } from "Data/Stores/StoreProvider";
import './UserItem.css';
import classNames from "classnames";
import { userAbsentsStatus } from "Helpers/IntervalHelper";
import { Tooltip } from 'antd';


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
		const status = userAbsentsStatus(this.context.items['absent'],id);
		let title=null;
		let absentClass=null;
		if (status.days<Infinity) {
			title=status.title;
			if (status.days<=14) {
				if (!status.days) {
					absentClass='ABSENT';
				} else if (status.days<7) {
					absentClass='WEEK_ABSENT';
				} else if (status.days<14) {
					absentClass = 'TWO_WEEK_ABSENT';
				}
			}
		}
		//if (s)
        return (
			<Tooltip title={title}>
				<td 
					title={title}
					style={{ width: 100/usersStore.count()+'%' }}
					className={classNames(
						'UserItem',
						'clickable',
						{'hovered':id===usersStore.hovered},
						absentClass
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
				</Tooltip>
        )
    }
}
UserItem.contextType=StoreContext;

export default UserItem;