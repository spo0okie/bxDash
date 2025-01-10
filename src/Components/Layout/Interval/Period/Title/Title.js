import React from "react";
import {observer} from "mobx-react";
import {get} from "mobx"
import './Title.css';
import { StoreContext } from "Data/Stores/StoreProvider";
//import UserItem from "./UserItem";
//import usersStore from '../../Stores/usersStore';

@observer class PeriodTitle extends React.Component {

    render() {
        let id=this.props.id;
        const period=get(this.context.periods.periods,id);
        return (
            <div className="PeriodTitle">
                <h3 title={period.toolTip}>{period.title}</h3>
            </div>
        )
    }
}
PeriodTitle.contextType=StoreContext;
export default PeriodTitle;