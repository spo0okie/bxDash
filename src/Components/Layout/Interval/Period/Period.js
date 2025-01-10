import React from "react";
import {observer} from "mobx-react";
import {get} from "mobx"
import PeriodTitle from "./Title/Title";
import PeriodData from "./Data/Data";
import { StoreContext } from "Data/Stores/StoreProvider";

import './Period.css';

@observer class Period extends React.Component {
    layoutClass() {
        //если у нас режим по умолчанию то период - строка, в которой по горизонтали разные пользователи (а заголовок слева)
        //в любом другом случае у нас пользователь один и период - колонка (а заголовок сверху)
        return this.context.users.selected===null?'row':'column';
    }

    render() {
        const id = this.props.id;
        const period=get(this.context.periods.periods,id);
		//console.log(period);
        //console.log('Period render');
        return (
            <div className={"Period "+this.layoutClass()+' '+period.className}>
				<div className="periodContent">
					<PeriodTitle id={id} key={id + '.title'} />
					<PeriodData id={id} key={id} />
				</div>
            </div>
        )
    }
}
Period.contextType=StoreContext;

export default Period;