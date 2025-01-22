import React, {useContext} from "react";
import { observer } from "mobx-react";
import { get } from 'mobx';
import { StoreContext } from "Data/Stores/StoreProvider";
import './UserCell.css'
import classNames from "classnames";


const UserCell= observer((props)=>{

	const context = useContext(StoreContext);
    const users=context.users;
	const period=get(context.periods.periods,props.period);

    const mouseIn = () => {context.users.setHover(props.user);};
    const mouseOut = () => {context.users.setHover(null);};

	//console.log(period.dragOverCell);
    return (
        <td className={classNames(
            "userCell",
            {'draggedOver':period.dragOverCell===props.id}
        )}
        style={{ 
			width: (users.selected!==null)?null:100/users.order.length+'%',
			display: (users.selected===props.user || users.selected===null)?null:'none'
		}}
        onMouseOver={mouseIn}
        onMouseOut={mouseOut}
    >
		{props.children}
    </td>)

})
export default UserCell;