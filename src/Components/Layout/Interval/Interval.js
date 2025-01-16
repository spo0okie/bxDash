import React from "react";
import {observer} from "mobx-react";
import {keys} from "mobx"
import { StoreContext } from "Data/Stores/StoreProvider";
import Period from "./Period/Period";
import './Interval.css';
import { Element } from "react-scroll";

@observer class Interval extends React.Component {

    render() {    
        const id = this.props.id;
        const layout=this.context.layout;
        const users=this.context.users;
        const periods=this.context.periods;
        const time=this.context.time;
        let start=time.weekStart(id);
        let end=time.weekEnd(id);

        let intervalClass="Interval"
        if (users.selected===null) {
            intervalClass+=" row"
        } else {
            if (layout.expand) {
                intervalClass+=(id>time.weekMax?" columnBucket":" personalRow")
            } else {
                intervalClass+=(id>time.weekMax?" columnBucket":" column")
            }
        }

        //console.log("Interval render "+id);

        return (
			<Element name={'interval'+id} className={intervalClass}>

					{
						keys(periods.periods)   //берем все периоды
						.filter((t)=>(t>=start) && (t<end)) //выбираем те, что попадают в интервал
						.map((t)=><Period id={t} key={t}/>)
					}
			</Element>
        )
    }
}
Interval.contextType=StoreContext;

export default Interval;