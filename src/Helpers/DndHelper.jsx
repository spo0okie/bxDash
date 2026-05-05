import { attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { draggable,	dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import ArrayHelper from './ArrayHelper';


/**
 * Какой будет новый индекс сортировки если элемент воткнуть в отсортированный список
 * @param {*} item элемент
 * @param {*} list список в который положили
 * @param {*} index позиция на какой элемент положили
 * @param {*} edge край элемента на который положили (top - вставить перед элементом; bottom - после)
 */
function dashItemNewSort(item, list, index, edge) {
	//убираем все недвижимые элементы из начала списка
	while (list.length && list[0].isUnmovable) {
		list.splice(0,1);
		index --;
	}

    const len=list.length;
    const last=len-1;
    if (!len) return item.sorting;  //если списка нет - не меняем

    if (index<0 || (index===0 && edge==='top')) {//если кинули над списком 
         return Math.min(
			list[0].sorting + 20,
			Math.round(list[0].sorting + (item.maxSort - list[0].sorting)/2)	//ограничиваем значение сверху
		 );
	}

    if (index>last || (index===last && edge==='bottom')) //если кинули над списком
         return list[last].sorting - 20;


    let neighbour=index;
    if (edge==='top') neighbour--;
    //if (edge==='left') neighbour--;
    if (edge==='bottom') neighbour++;
    //if (edge==='right') neighbour++;

    console.log('inserting ite between '+index+' & '+neighbour
        +' sort of '+Math.min(list[index].sorting,list[neighbour].sorting)+' and '+Math.max(list[index].sorting,list[neighbour].sorting));
    return Math.round((list[index].sorting + list[neighbour].sorting)/2);
}


/**
 * Был ли drop фактически "на то же место". Условия разные для drop-on-item и drop-on-cell:
 * - на элемент: попали в соседа сверху+top или снизу+bottom (и в ту же ячейку);
 * - на ячейку: уже последний в списке этой ячейки.
 */
function isDropOnSelf(targetCell, sourceCell, oldIndex, dropOnItem) {
    if (targetCell.data.cell.id !== sourceCell.data.cell.id) return false;
    if (dropOnItem) {
        const { index, edge } = dropOnItem;
        return index === oldIndex
            || (index === oldIndex + 1 && edge === 'top')
            || (index === oldIndex - 1 && edge === 'bottom');
    }
    // drop в пустое место ячейки (= в конец); если уже был последним — ничего не меняется
    return targetCell.data.items.length - 1 === oldIndex;
}

/**
 * Сборка параметров для item.movePosition. Параметр копируется только если он
 * реально меняется относительно sourceCell — тогда movePosition покажет confirm
 * только по релевантным полям.
 */
function buildMoveParams(item, sourceCell, targetCell, newSort) {
    const params = {
        deadline: item.deadline,
        user: item.user,
        sorting: item.sorting,
    };
    if (newSort !== item.sorting) {
        console.log('changing sort: ' + item.sorting + ' => ' + newSort);
        params.sorting = newSort;
    }
    if (targetCell.data.cell.t !== sourceCell.data.cell.t) {
        console.log('changing time => ' + targetCell.data.cell.dropT);
        params.deadline = targetCell.data.cell.dropT;
    }
    if (targetCell.data.cell.user !== sourceCell.data.cell.user) {
        console.log('changing user => ' + targetCell.data.cell.user);
        params.user = targetCell.data.cell.user;
    }
    if (targetCell.data.cell.priority !== null && targetCell.data.cell.priority !== undefined) {
        params.priority = targetCell.data.cell.priority;
    }
    return params;
}

/**
 * Новый sort-индекс при drop:
 * - если бросили на элемент — между соседями по edge (через dashItemNewSort);
 * - если бросили в ячейку — в конец списка (на 100 ниже последнего);
 * - если ячейка пустая — оставляем текущий sorting.
 */
function computeNewSort(item, targetList, dropOnItem) {
    if (dropOnItem) {
        return dashItemNewSort(item, targetList, dropOnItem.index, dropOnItem.edge);
    }
    const last = targetList.length - 1;
    if (last < 0) return item.sorting;
    return targetList[last].sorting - 100;
}

/**
 * Общий вызов когда карточку бросили куда-то. Один путь для drop-on-item и drop-on-cell.
 * @param {*} item карточка
 * @param {*} location место куда бросили (от @atlaskit/pragmatic-drag-and-drop)
 */
export function dashItemsDrop(item, location) {
    const sourceCell = location.initial.dropTargets.find(s => s.data.type === 'cell');
    if (!sourceCell) { console.log('Cant find source cell. Halt DND!'); return; }

    const targetCell = location.current.dropTargets.find(t => t.data.type === 'cell');
    if (!targetCell) { console.log('Cant find target cell. Halt DND!'); return; }

    const targetItem = location.current.dropTargets.find(t => t.data.type === 'item');
    let dropOnItem = null;
    if (targetItem) {
        const edge = extractClosestEdge(targetItem.data);
        const index = targetItem.data.index;
        if (edge === undefined || index === undefined) {
            console.log('Cant extract edge/index from target item. Halt DND!');
            return;
        }
        dropOnItem = { edge, index };
    }

    const targetList = targetCell.data.items;
    const sourceList = sourceCell.data.items;
    if (!targetList || !sourceList) { console.log('Cant find cell items list. Halt DND!'); return; }

    const oldIndex = sourceList.findIndex(i => i.uid === item.uid);
    if (oldIndex === -1) { console.log('Cant find myself in source cell. Halt DND!'); return; }

    console.log(sourceCell.data.cell.id + ' ==> ' + targetCell.data.cell.id);

    if (isDropOnSelf(targetCell, sourceCell, oldIndex, dropOnItem)) {
        console.log('Dropped on itself. nothing to do');
        return;
    }

    const newSort = computeNewSort(item, targetList, dropOnItem);
    const params = buildMoveParams(item, sourceCell, targetCell, newSort);
    item.movePosition(params);
}


/* const dropData = {
    type:'item',		//тип - элемент списка
    element:ref.current,//ссылка на отрисованный элемент
    item:task,			//dashItem элемент (task|job|ticket|plan)
    index:index,		//порядок элемента в списке
    cell:{	        	//ячейка в которой и список и элемент
        t:id,                       //временная отметка
        user:props.user,            //пользователь
        id:id+'/'+props.user,       //ключ
        dropT:period.dropTime,      //на какое время ставить задачи падающие в эту ячейку
        dragOver:setDragOver        //зажигатель флага "надо мной тащят карточку"
    }
};*/
export function dashItemDragLogic(dropData,ref,setClosestEdge) {
	//console.log(dropData.item.isEdit);
	if (dropData.item.isNew || dropData.item.isEdit) return;    //т.к. иначе глючит работа textarea внутри этого элемента и нельзя выделять текст мышью
    //let targetCell=null;    //ячейка над которой нас протаскивают
    const element=ref.current;
	//if (dropData.item.type==='memo') console.log(dropData);
    //признак что кидаем на верхнюю половинку карточки ниже или нижнюю половинку карточки выше, по итогу туда же
    const samePlace=(source,cell,index,closestEdge)=>{
	    const isItemBeforeSource = index === source.data.index - 1 && cell.id===source.data.cell.id;
	    const isItemAfterSource = index === source.data.index + 1 && cell.id===source.data.cell.id;
	    return (isItemBeforeSource && closestEdge === 'bottom') || (isItemAfterSource && closestEdge === 'top');
    }

    // тут такой хитрый маневр потому что, если просто гасить ячейку на onLeave с карточки то при движению по списку карточек ячейка мерзейше моргает
	// нам надо запоминать текущую ячейку и гасить только если она меняется
    const setCell=(cell)=>{
        const cellId=(cell)=>(cell===null || cell===undefined)?null:cell.id;

        //console.log(dropData.item.uid+': switching dragover cell from '+cellId(dropData.item.dragCell)+' to '+cellId(cell));
        //если у нас нет ячейки или поменялась ячейка
		if (cellId(cell)!==cellId(dropData.item.dragCell)) {
			if (dropData.item.dragCell!==null) dropData.item.dragCell.dragOver(false);  //гасим старую ячейку (если она не пуста)
			dropData.item.dragCell=cell;                                    //запоминаем новую			
			if (dropData.item.dragCell!==null) dropData.item.dragCell.dragOver(true);   //зажигаем новую
		}
        //console.log(dropData.item.uid+': '+cellId(cell)+' saved');
    }
    //console.log(dropData.item);
    
	
	
	return combine(
		//для того чтобы элемент можно было таскать
		draggable({
			element: element,
			getInitialData: () => {return{
				setCell: setCell,
				type: dropData.type,
			}},
			canDrag: () => dropData.item.isDraggable(dropData.cell),   //не все можно переносить
			onDragStart: () => {
				console.log('drag start');
				dropData.item.setHover(false);
				dropData.item.setDragging(true);        //говорим что потащили элемент (старое место должно стать полупрозрачным)
			},
			onDragStop: () => {
				console.log('drag stop');
				dropData.item.setDragging(false);       //говорим что закончили тащить элемент
				setCell(null);                          //гасим ячейку
			},
			onDrop: ({location}) => {
				console.log('drag complete');
				setCell(null);                          //гасим ячейку
				dropData.item.setDragging(false);       //говорим что закончили тащить элемент
				dashItemsDrop(dropData.item,location);  //обрабатываем бросок
			},
		}),
			
		//для того чтобы на элемент можно было бросать другой элемент (вставка в список)
		dropTargetForElements({
			element: element,
			canDrop({ source }) {
				//нельзя бросать на недвижимые элементы списка, и на самого себя (ну или можно но надо обработать как то иначе)
				//console.log(source.data.type);
				return (source.data.type==='item') && dropData.item.isDraggable(dropData.cell); // && source.element !== dropData.element;
			},
			getData({ input }) {//когда над нами тащят элемент
				//на основании координат мыши (input) и отрендеренного элемента (element) оно добавит к dropData поле Edge - ближайшую к точке сброса грань из вариантов [top,bottom]
				return attachClosestEdge(dropData, {
					element:dropData.element,
					input,
					allowedEdges: ['top', 'bottom'],
				});
			},
			onDrag({ self, source }) {
				//если над нами что-то тащат, то подсветим всю свою ячейку (для наглядности)
				//if (source.data.setCell!==undefined) source.data.setCell(dropData.cell);

				//если мы тащим себя над собой, то выставляем ближйшую грань как null и больше ничего не делаем
				if (source.element === dropData.element) {setClosestEdge(null); return;}

				//загружаем ближайшую грань, которую сохранили через getData
				const closestEdge = extractClosestEdge(self.data);

				//если мы тащим себя над соседними ячейками и падаем в итоге на то же место, то тоже прячем грань и выходим
				if (samePlace(source,dropData.cell,dropData.index,closestEdge)) {setClosestEdge(null); return;}

				//выставляем внутреннее значение ближайшей грани элемента (используется потом при отрисовке)
				setClosestEdge(closestEdge);
			},
			onDragLeave() {
				setClosestEdge(null);   //убираем подсветку грани
			},
			onDrop() {
				setClosestEdge(null);   //убираем подсветку грани
			},
		}),
	)
}



/**
 * Какой будет новый индекс сортировки если элемент воткнуть в отсортированный список
 * @param {*} list список в который положили
 * @param {*} itemIndex элемент
 * @param {*} targetIndex позиция на какой элемент положили
 * @param {*} edge край элемента на который положили (top - вставить перед элементом; bottom - после)
 */
export function dashUserNewPos(list, itemIndex, targetIndex, edge) {

	let before=targetIndex;
	let after=targetIndex;

	console.log(edge);
    if (edge==='left') after--;
    if (edge==='right') before++;
	if (after<0) after=null;
	if (before>=list.length) before=null;

    return ArrayHelper.moveItem(list,itemIndex,after,before);
}
