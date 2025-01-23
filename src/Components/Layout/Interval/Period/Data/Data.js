import React from "react";
import {observer} from "mobx-react";
import {get,keys,values,trace} from "mobx"
import { StoreContext } from "Data/Stores/StoreProvider";
import "./Data.css";
import UserCell from "./UserCell/UserCell"; 
import { dashClosedItemsSort, dashItemsSort } from "Helpers/SortHelper";
import UserCellHeader from "./UserCell/UserCellHeader";
import { userPeriodAbsentsGradient } from "Helpers/IntervalHelper";
import CardsBlock from "./UserCell/CardsBlock";
import CreateItemButton from "Components/Items/CreateItemButton/CreateItemButton";

@observer class PeriodData extends React.Component {
    
	render() {
        //trace();
        let id=this.props.id;
		const users=this.context.users;
        const period=get(this.context.periods.periods,id);
		//console.log(period);
        const items={};
		
		//перебираем типы элементов
		this.context.items.types.forEach(type=>{
			//сбрасываем элементы этого типа для этого периода
			//
			items[type]=[];
			
			//перебираем ID элементов этого типа в этом периоде (из объекта периода)
			get(period.itemsIds.ids, type).forEach(id => {
				//запоминаем элемент этого типа
				items[type].push(
					get(this.context.items[type].items, id)
				);
			});
		})
		
		//console.log(items);
		
		//общее хранилище всех элементов

		
		//console.log(tickets);
		const layout=			this.context.layout;
		
		const closedTasks=		items['task'].filter((task)=>task.isClosed);
		const openedTasks=		items['task'].filter((task)=>!task.isClosed);
		const closedJobs =		items['job'].filter((job) => job.isClosed);
		const openedJobs =		items['job'].filter((job) => !job.isClosed); 
		const closedTickets =	items['ticket'].filter((item) => item.isClosed);
		const openedTickets =	items['ticket'].filter((item) => !item.isClosed); 
		const plans = 			items['plan'];		//.filter((item) => item.user === props.user);


		//console.log(closedTasks);
		//console.log(items['job']);

        //console.log('Period '+TimeHelper.strDateHuman(id)+' data render ('+tasks.length+')');
        return (
            <div className="PeriodData">
				<table className="UserCells">
                    <tbody>
                        <tr>
							{users.order.map((i) => {
								const cellId='cell'+id+'/'+i;
								const cellOptions=userPeriodAbsentsGradient(
									this.context.items['absent'],
									period.start,
									period.end,
									i,
								);
								const uClosedTasks	= closedTasks.filter((item) => item.user === i || (layout.accomplicesVisible && item.accomplices.includes(i)));
								const uOpenedTasks	= openedTasks.filter((item) => item.user === i || (layout.accomplicesVisible && item.accomplices.includes(i)));
								const uClosedJobs	= closedJobs.filter((item) => item.user === i);
								const uOpenedJobs	= openedJobs.filter((item) => item.user === i);
								const uClosedTickets = closedTickets.filter((item) => item.user === i);
								const uOpenedTickets = openedTickets.filter((item) => item.user === i);
								const uPlans		= plans.filter((item) => item.user === i);

								let openedItems=[];
								let closedItems=[];
								
								openedItems.push(...uOpenedTasks);
								openedItems.push(...uOpenedJobs);
								openedItems.push(...uOpenedTickets);
								openedItems=openedItems.sort((a,b)=>dashItemsSort(b,a));
								
								closedItems.push(...uPlans);
								closedItems.push(...uClosedJobs);
								closedItems.push(...uClosedTasks);
								closedItems.push(...uClosedTickets);
								closedItems=closedItems.sort((a,b)=>dashClosedItemsSort(b,a));
								
								//console.log(openedItems);

								const cell={
									t:id,						//временная отметка
									user:i,						//пользователь
									id:cellId,					//ключ
									dropT:period.dropTime,		//на какое время ставить задачи падающие в эту ячейку
									period:period,
									maxSorting:openedItems.length?openedItems[0].sorting:null,
									minSorting:openedItems.length?openedItems[openedItems.length-1].sorting:null,
									dragOver:(value)=>{
										//console.log(value);
										if (value) 
											period.setDragOverCell(cellId);
										else 
											period.setDragOverCell(null);
									}
								}
						
								return(<UserCell key={cellId} user={i} period={id} id={cellId}>
									<div className="userCellContent" style={{background:cellOptions.background}} title={cellOptions.title}>
										<UserCellHeader 
											key={'header'+cellId} 
											closedTasks={uClosedTasks} 
											openedTasks={uOpenedTasks} 
											closedJobs={uClosedJobs}
											openedJobs={uOpenedJobs}
											closedTickets={uClosedTickets}
											openedTickets={uOpenedTickets}
										/>
										<CardsBlock key={'closed' + cellId} items={closedItems} cell={cell} dnd={false} />
										<CreateItemButton cell={cell}/>
										{period.isOpen && <CardsBlock	key={'open' + cellId} items={openedItems} cell={cell} dnd={true} />}
									</div>
								</UserCell>);
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }
}
PeriodData.contextType=StoreContext;
export default PeriodData;