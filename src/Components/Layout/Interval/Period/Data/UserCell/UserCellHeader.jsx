import React from "react";
import './UserCellHeader.css';
//import {observer} from "mobx-react";
//import {get} from "mobx"
class UserCellHeader extends React.Component {
    mouseIn = () => {
    //    this.context.users.setHover(this.props.user);
    };

    mouseOut = () => {
    //    this.context.users.setHover(null);
    };
    
    render() {
    //    let id=this.props.id;
    //    const period=get(this.context.periods.periods,id);
    //    const users=this.context.users;
		const closedJobsCount=this.props.closedJobs.length;
		const closedTasksCount=this.props.closedTasks.length;
		const openedJobsCount = this.props.openedJobs.length;
		const openedTasksCount = this.props.openedTasks.length;
		const closedTicketsCount = this.props.closedTickets.length;
		const openedTicketsCount = this.props.openedTickets.length;

		return (<div className="userCellHeader" title="Элементы за этот период">
			<span className="closedTicketsCountLabel" title="Закрыто тикетов">{closedTicketsCount ? closedTicketsCount : ''}</span>
			<span className="closedJobsCountLabel" title="Выполнено работ">{closedJobsCount?closedJobsCount:''}</span>
			<span className="closedTasksCountLabel" title="Закрыто задач">{closedTasksCount?closedTasksCount:''}</span>
			<span className="openTicketsCountLabel" title="Тикетов">{openedTicketsCount ? openedTicketsCount : ''}</span>
			<span className="openJobsCountLabel" title="Запланировано работ">{openedJobsCount?openedJobsCount:''}</span>
			<span className="openTasksCountLabel" title="Задач на этот период">{openedTasksCount?openedTasksCount:''}</span>
		</div>);

    }
}
//UserCellHeader.contextType=StoreContext;
export default UserCellHeader;