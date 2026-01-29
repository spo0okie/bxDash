import React, {useContext} from "react";
import {observer} from "mobx-react";
import { StoreContext } from "Data/Stores/StoreProvider";
import { dashItemsSort,dashClosedItemsSort } from "Helpers/SortHelper";
import CardsBlock from "Components/Layout/Interval/Period/Data/UserCell/CardsBlock";
import MemoItem from "Data/Items/MemoItem";
import TimeHelper from "Helpers/TimeHelper";

const MemoCell= observer((props)=>{

	const context = useContext(StoreContext);
    
    //trace();
	const items=context.items['memo'];
	//console.log(items);

	let openedItems = [];
	let closedItems = [];
	items.items.forEach(item => {
		if (item.isOpen) openedItems.push(item);
		if (item.isClosed) closedItems.push(item);
	});

	const CreateMemoButton = (props) => {
		const onClick = () => {
			const items = props.context.items['memo']
			//console.log('new task');
			//console.log(props.cell);
			const item = new MemoItem({
				id: items.getMaxId() + 64,
				user: 1,
				deadline: TimeHelper.getTimestamp(),
				isNew: true,
				isEdit: true,
				sorting: maxSorting ? maxSorting + 20 : null,
			}, {}, items);
			//console.log(job);
			items.setItem(item);
		}
		return <span className="create memo" onClick={onClick}>добавить</span>
	}

	//описание ячейки для дочерних объектов
	const cell = {
		t: null,						//временная отметка
		user: 1,						//пользователь
		id: 'memos/1',					//ключ
		dropT: null,			//на какое время ставить задачи падающие в эту ячейку
		isToday: true,
		period: null,
		maxSorting: openedItems.length ? openedItems[0].sorting : null,
		dragOver: (state) => {}
	}

	openedItems=openedItems.sort((a,b)=>dashItemsSort(b,a));

	closedItems=closedItems.sort((a,b)=>dashClosedItemsSort(b,a));
	const maxSorting=openedItems.length?openedItems[0].sorting: null

   
    //console.log('userCell render '+cell.id+'('+TimeHelper.strDateHuman(cell.t)+'): '+tasks.length);
    return (
        <div className="userCellContent memoCell">
			<CardsBlock key={'closedMemo'} items={closedItems} cell={cell} dnd={false} />
			<span className="CreateItemButton"><CreateMemoButton context={context}/></span>
			<CardsBlock
				key={'openMemo'}
				items={openedItems}
				dnd={true}
				cell={cell} 
			/>
        </div>
    )

})
export default MemoCell;