import React, {useState,useContext} from "react";
import {observer} from "mobx-react";
import {get,trace} from "mobx"
import { StoreContext } from "Data/Stores/StoreProvider";
import UserCellHeader from "./UserCellHeader";
import './UserCell.css'
import classNames from "classnames";
import { dashItemsSort,dashClosedItemsSort } from "Data/Items/DashItem";
import CreateItemButton from "Components/Items/CreateItemButton/CreateItemButton";
import CardsBlock from "./CardsBlock";
import { userPeriodAbsentsGradient } from "Helpers/IntervalHelper";

const UserCell= observer((props)=>{

	const context = useContext(StoreContext);
    
    //trace();
    const id=props.period;
	const layout=context.layout;
	const tasks = props.items['task'].filter((task) => task.user === props.user || (layout.accomplicesVisible && task.accomplices.includes(props.user)));
	const jobs = props.items['job'].filter((job) => job.user === props.user);
	const plans = props.items['plan'].filter((item) => item.user === props.user);
	const tickets = props.items['ticket'].filter((item) => item.user === props.user);

	//console.log(tickets);

    const users=context.users;
    const period=get(context.periods.periods,id);
    const closedTasks=tasks.filter((task)=>task.isClosed);
    const openedTasks=tasks.filter((task)=>!task.isClosed);
	const closedJobs = jobs.filter((job) => job.isClosed);
	const openedJobs = jobs.filter((job) => !job.isClosed); 
	const closedTickets = tickets.filter((item) => item.isClosed);
	const openedTickets = tickets.filter((item) => !item.isClosed); 
	let openedItems=[];
	let closedItems=[];

	openedItems.push(...openedTasks);
	openedItems.push(...openedJobs);
	openedItems.push(...openedTickets);
	openedItems=openedItems.sort((a,b)=>dashItemsSort(b,a));

	closedItems.push(...plans);
	closedItems.push(...closedJobs);
	closedItems.push(...closedTasks);
	closedItems.push(...closedTickets);
	closedItems=closedItems.sort((a,b)=>dashClosedItemsSort(b,a));
	//console.log(openedTickets);
	//console.log(plans);

    const [dragedOver,setDragOver]=useState(false);
    
    //описание ячейки для дочерних объектов
    const cell={
        t:id,                       //временная отметка
        user:props.user,            //пользователь
        id:id+'/'+props.user,       //ключ
        dropT:period.dropTime,      //на какое время ставить задачи падающие в эту ячейку
		isToday:period.isToday,
		period:period,
        maxSorting:openedItems.length?openedItems[0].sorting:null,
        dragOver:(state)=>{
			console.log('Lighting '+id+'/'+props.user+' => '+state);
			setDragOver(state)        //зажигатель флага "надо мной тащят карточку"					
        }
    }

    const mouseIn = () => {context.users.setHover(props.user);};
    const mouseOut = () => {context.users.setHover(null);};
	const cellOptions=userPeriodAbsentsGradient(context.items['absent'],period.start,period.end,props.user);
	//console.log(cellOptions);
    
    //console.log('userCell render '+cell.id+'('+TimeHelper.strDateHuman(cell.t)+'): '+tasks.length);
    return (
        <td
        className={classNames(
            "userCell",
            {'draggedOver':dragedOver}
        )}
        style={{ width: 100/users.count()+'%' }}
        //className={"User "+(id===users.hovered?'hovered':'')}
        onMouseOver={mouseIn}
        onMouseOut={mouseOut}
    >
		
        <div className="userCellContent" style={{background:cellOptions.background}} title={cellOptions.title}>
            <UserCellHeader 
				key={'header'+cell.id} 
				closedTasks={closedTasks} 
				openedTasks={openedTasks} 
				closedJobs={closedJobs}
				openedJobs={openedJobs}
				closedTickets={closedTickets}
				openedTickets={openedTickets}
			/>
				<CardsBlock key={'closed' + cell.id} items={closedItems} cell={cell} dnd={false} />
				<CreateItemButton cell={cell} closed={cell.isClosed} />
				<CardsBlock
					key={'open' + cell.id}
					items={openedItems}
					cell={cell}
					dnd={true}
				/>
		</div>
    </td>)

})
export default UserCell;