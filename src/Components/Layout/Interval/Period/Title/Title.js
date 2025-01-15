import React from "react";
import {observer} from "mobx-react";
import {get} from "mobx"
import './Title.css';
import { StoreContext } from "Data/Stores/StoreProvider";
import { Button } from "antd";
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
					<Button className='add' onClick={()=>time.decWeekMin()}/>
					{time.weekMin<0 && <Button onClick={()=>time.incWeekMin()}>X</Button>}
				</span>}
                <h3 title={period.toolTip}>{period.title}</h3>
				{period.end===time.lastWeekEnd() && <span className="nextWeekButton">
					{time.weekMax>0 && <Button onClick={()=>time.decWeekMax()}>X</Button>}
					<Button className='add' onClick={()=>time.incWeekMax()}/>
				</span>}
            </div>
        )
    }
}
PeriodTitle.contextType=StoreContext;
export default PeriodTitle;