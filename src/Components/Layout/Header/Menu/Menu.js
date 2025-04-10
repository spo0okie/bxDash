import React  from "react";
import {observer} from "mobx-react";
import './Menu.css';
import { StoreContext } from "Data/Stores/StoreProvider";
import MenuButton from "./MenuIButton";

@observer class Menu extends React.Component {

	planningMode = () => {
		this.context.layout.setPlansVisible(true);
		this.context.layout.setJobsVisible(false);
		this.context.layout.setExpand(false);
		this.context.layout.setAccomplicesVisible(false);
		this.context.layout.setTicketsVisible(false);
		this.context.layout.setTasksVisible(false);
		this.context.layout.setKeepPlanning(true);
	}
	defaultMode = () => {
		this.context.layout.setPlansVisible(true);
		this.context.layout.setJobsVisible(true);
		this.context.layout.setExpand(true);
		this.context.layout.setAccomplicesVisible(false);
		this.context.layout.setTicketsVisible(true);
		this.context.layout.setTasksVisible(true);
		this.context.layout.setKeepPlanning(false);
	}

    render() {
        const time=this.context.time;
		const layout=this.context.layout;

        return (
            <div className="AppMenu">
				<div className="left section">
					<MenuButton property='memosVisible' title='&lt; заметки' />
					&nbsp;
					<MenuButton property='expand' title='дни' />
					<MenuButton property='expand' title='недели' classNames={['off', 'on']} />
					&nbsp;
					<MenuButton property='tasksVisible' title='задачи' />
					<MenuButton property='accomplicesVisible' title='помогаю' />
					<MenuButton property='jobsVisible' title='работы' />
					<MenuButton property='ticketsVisible' title='заявки' />
					<MenuButton property='plansVisible' title='планы' />
					<MenuButton property='keepPlanning' title='keepPlanning' />
				</div>
				
				<div className="central section">
					<span className="MenuTimer">
						<button onClick={this.planningMode} className="small">Режим планирования</button>
						<button onClick={this.defaultMode} className="small">Сброс</button>
						&nbsp;
						Time: {time.strTime}
						</span>                
				</div>
				<div className="right section">
					<MenuButton property='debugVisible' title='dbg' />
				</div>
            </div>
        )
    }
}
Menu.contextType=StoreContext;
export default Menu;