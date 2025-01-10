import React  from "react";
import {observer} from "mobx-react";
import './Menu.css';
import { StoreContext } from "Data/Stores/StoreProvider";

@observer class MenuButton extends React.Component {

	toggle = () => {
		let property = this.props.property;
		let setProperty = 'set' + property.charAt(0).toUpperCase() + property.slice(1);
		this.context.layout[setProperty](!this.context.layout[property]);
	}

	getCondition=()=>{
		let property = this.props.property;
		return this.context.layout[property];
	}

	getTitle=()=>{
		let title=this.props.title;
		//если наш заголовок не был массивом, то мы его используем в обоих сценариях
		if (!Array.isArray(title)) title = [this.props.title, this.props.title];
		if (this.getCondition()) return title[0];
		return title[1];
	}

	getClass=()=>{
		let classNames = this.props.classNames === undefined ? ['on','off'] : this.props.classNames;
		if (!Array.isArray(classNames)) classNames = [classNames, classNames];
		if (this.getCondition()) return classNames[0];
		return classNames[1];
	}

    render() {

        return (
            <button 
			onClick={this.toggle} 
			className={"small "+this.getClass()}
			>{this.getTitle()}</button>
        )
    }
}
MenuButton.contextType=StoreContext;
export default MenuButton;