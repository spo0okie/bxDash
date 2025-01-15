import React from "react";
import {observer} from "mobx-react";
import {get} from "mobx"
import './Title.css';
import { StoreContext } from "Data/Stores/StoreProvider";
import { Button, Tooltip } from "antd";
//import UserItem from "./UserItem";
//import usersStore from '../../Stores/usersStore';

@observer class PeriodTitle extends React.Component {

    render() {
        let id=this.props.id;
        const period=get(this.context.periods.periods,id);
		const time=this.context.time;
        return (
            <div className="PeriodTitle">
				{period.start===time.firstWeekStart() && <span className="prevWeekButton">
					<Tooltip title={'Добавить предыдущую неделю'}><Button className='add' onClick={()=>time.decWeekMin()}/></Tooltip>
					{time.weekMin<0 && <Tooltip title={'Убрать эту неделю с доски'}><Button onClick={()=>time.incWeekMin()}>X</Button></Tooltip>}
				</span>}
                <Tooltip title={period.toolTip}><h3>{period.title}</h3></Tooltip>
				{period.end===time.lastWeekEnd() && <span className="nextWeekButton">
					{time.weekMax>0 && <Tooltip title={'Убрать эту неделю с доски'}><Button onClick={()=>time.decWeekMax()}>X</Button></Tooltip>}
					<Tooltip title={'Добавить следующую неделю'}><Button className='add' onClick={()=>time.incWeekMax()}/></Tooltip>
				</span>}
            </div>
        )
    }
}
PeriodTitle.contextType=StoreContext;
export default PeriodTitle;