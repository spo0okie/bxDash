import React from "react";
import {observer} from "mobx-react";
import {get,keys,values,trace} from "mobx"
import { StoreContext } from "Data/Stores/StoreProvider";
import "./Data.css";
import UserCell from "./UserCell/UserCell"; 

@observer class PeriodData extends React.Component {
    
	render() {
        //trace();
        let id=this.props.id;
		const users=this.context.users;
        const period=get(this.context.periods.periods,id);
        const itemsStorage=this.context.items;	//общее хранилище всех элементов
		const items={}							//наше частное только для этого периода

		//перебираем типы элементов
		itemsStorage.types.forEach(type=>{
			//сбрасываем элементы этого типа для этого периода
			items[type]=[];
			//console.log(get(period.itemsIds.ids,type));
			
			//перебираем ID элементов этого типа в этом периоде (из объекта периода)
			get(period.itemsIds.ids, type).forEach(id => {
				//запоминаем элемент этого типа
				items[type].push(get(itemsStorage[type].items, id));
			});
		})
		//console.log('period');
		//console.log(items['job']);

        //console.log('Period '+TimeHelper.strDateHuman(id)+' data render ('+tasks.length+')');
        return (
            <div className="PeriodData">
				<table className="UserCells">
                    <tbody>
                        <tr>
							{users.order.map((i) => {
								const user=get(users.items,i);
                                if(users.selected===user.id || users.selected===null) 
                                    return (<UserCell 
                                        key={'cell'+id+'/'+user.id} 
                                        user={user.id} 
                                        period={id}
										items={items} 
                                    />)
								return null;
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