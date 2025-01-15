import { observable, keys, action, makeObservable, get, has} from 'mobx';
import { attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { draggable,	dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import TimeHelper from "Helpers/TimeHelper";
import RelativesMixin from './Mixins/RelativesMixin';

export default class DashItem {
    id;						//id внутри класса элементов (id задачи, заявки, работы)
	list=null;				//ссылка на хранилище всех элементов этого типа
	context=null;			//остальные хранилища
    
	type='dash';			//тип элемента (task|job|ticket|plan)
    uid;					//unique id type+id (чисто по id может совпасть задача1 и работа1, а вместе с типом нет)
	
	parentUids = [];		//родительские элементы (uid)
	childUids = [];			//подчиненные элементы (uid)
	linksAttr='title';		//откуда берем текст элемента чтобы поискать ссылки на другие объекты
	titleLinks='childUids';	//кем являются ссылки в тексте (родителями или потомками)
	
	parents = [];			//родительские элементы (объект)
	children = [];			//подчиненные элементы (объекты)

	intervalId=null;		//в какой интервал попадает элемент
	periodId=null;			//в какой период попадает элемент

    title='';				//заголовок (что будет писаться на доске)
	defaultTitle='';		//какой заголовок у элементов по умолчанию

	user=null;				//к какому пользователю относится

    createdAt=null;			//отметка когда создан элемент
    deadline=null;			//плановый срок выполнения элемента
    closedDate=null;		//реальный срок закрытия элемента
    t;						//в какую временную отметку нужно поместить элемент (в зависимости от статусов объекта)
    
	isClosed = false;		//завершено
	isOpen = true;			//открыто
    isNow=false;			//[прямо сейчас] для съезжающих по дате на сегодня: выполняемые, просроченные
	
	isNew = true;			//признак, что это не загруженный элемент, а новый
	
	isEdit = false;			//признак что в настоящее время элемент редактируется
	editField = 'title';	//какой аттрибут редактируется
	editValue = '';			//временное значение редактируемого поля
	deleteOnEmpty=true;		//удалять элемент если его содержимое удалили при редактировании

    sorting=null;			//сортировочный индекс
	maxSort = 2147483647;	//максимальное значение для INT в mysql

    favorite=false;			//избранное (звездочка)
	semiFavorite=false;		//потомк избранного

    isUpdating=false;		//признак промежуточного состояния: обновляется, загружается, сохраняется...
    isAlert=null;			//нужно ругнуться что с этим элементом ошибка (сохранения или типа того). После того как ругнулись - надо будет снять флажок
	isFlash=false;			//нужно обратить на себя внимание

	isExpanded=false;		//развернут

	isHovered=false;		//над элементом мышка
	isHoveredParent = false;//мышка над потомком элемента
	isHoveredChild = false;	//мышка над предком элемента

    isDragging=false;		//признак, что сейчас элемент перетаскивается
    dragCell=null;			//над какой ячейкой элемент тащат
	isUnmovable=false;

	confirmMove = true;		//подтверждать изменение параметров при передвигании ячейки
	confirmCancelEditNew = '';		//какой вопрос задавать если нажали ESC при создании (редактировании текста) нового элемента (не задавать вопрос если пусто)
	confirmCancelEditUpdate = '';	//какой вопрос задавать если нажали ESC при редактировании сузествующего элемента (не задавать вопрос если пусто)


	isDraggable(cell) {
		return !this.isClosed   //закрытые не таскаем
		&& !this.isUpdating     //обновляемые тоже
		&& !this.isNew          //и не создание нового элемента
		&& !this.isEdit          //и не создание нового элемента
		&& this.user===cell.user;//только те элементы где мы хозяева
	}

	isPlanItem() {
		if (this.type==='plan') return true;
		return this.parents.some(parent => parent.isPlanItem());
		//return false;
	}

	broadcastUpdate() {
		this.list.broadcastUpdate(this.id);
		return this;
	}

	broadcastRemove() {
		this.list.broadcastRemove(this.id);
		return this;
	}

    setUpdating(value) {
        //console.log('Updating '+this.id);
        this.isUpdating=value;
		return this;
    };

	setAlert(value) {
		//console.log('Alerting '+this.id);
		this.isAlert = value
		return this;
	};

	setFlash(value) {
		this.isFlash = value
		return this;
	};

    setDragging(value) {
        this.isDragging=value;
		return this;
    }
	
	setEdit(value) {
		this.isEdit = value;
	}

	setExpanded(value) {
		this.isExpanded = value;
	}

	setHover(value) {
		this.isHovered=value;
		//console.log(this.uid+' hover is '+value);
		//console.log(this.parents);
		this.parents.forEach(parent => parent.setParentHover(value));
		this.children.forEach(child => child.setChildHover(value));
		this.list.activityUpdate();
		return this;
	}	

    setParentHover(value) {
        this.isHoveredParent=value;
		return this;
    }

	setChildHover(value) {
        this.isHoveredChild=value;
		return this;
    }

	/**
	 * Признак что родитель подсвечен
	 */
	isChildHovered() {
		let result=false;
		this.parents.forEach(parent=>result=result||parent.isHovered);
		return result;
	}

    /**
     * выставить алерт состояние ненадолго
     */
    alertItem(duration=400) {
        this.setAlert(true);
        setTimeout(()=>{this.setAlert(false);}, duration);
		return this;
    }

	/**
	 * выставить алерт состояние ненадолго
	 */
	flashItem(duration = 400) {
		this.setFlash(true);
		setTimeout(() => { this.setFlash(false);}, duration);
		return this;
	}


	findInterval(ids = null) {
		let homeless=false;
		let found=false;

		//если явно не сказали среди каких периодов искать - ищем среди всех
		if (ids === null) { 
			ids = keys(this.context.periods.intervals).sort((a,b)=>b-a); //делаем обратно отсортированный список, чтобы искать всегда с конца (где ведро)
			//console.log(ids);
			homeless=true;	//если интервал не будет найден из всего набора, значит элемент никуда не входит
		}

		//для оптимизации надо наверно список развернуть от больших id к маленьким, т.к. половина осядет в ведре
		ids.forEach(id => {
			if (found) return;	//нам нужен первый совпавший
			const interval = get(this.context.periods.intervals, id);
			//console.log(id);
			if (interval.filterItem(this)) {
				this.setInterval(id);
				homeless=false;
				found=true;
			}
		});

		if (homeless) {
			this.unsetInterval()
			console.log(this);
		} else {
			//console.log(this.intervalId);
		}
	}

	/**
	 * Отстегивает итем от интервала и убирает себя из него  (двусторонний разрыв ссылок)
	 */
	unsetInterval() {
		if (this.intervalId !== null) {			//если уже был интервал
			if (has(this.context.periods.intervals, this.intervalId))
				get(this.context.periods.intervals, this.intervalId)
					.detachItem(this);				//отцепляемся от него
		}
		this.intervalId = null;
	}

	/**
	 * Прикрепляет элемент к интервалу
	 * Используется в сценарии, когда элемент загружается/обновляется:
	 *   - Страница загружается (сначала сетка потом элементы)
	 *   - Страница дозагружается (также)
	 *   - Элемент перечитывается, добавляется
	 * @param {*} id 
	 * @returns 
	 */
	setInterval(id) {		
		const interval=get(this.context.periods.intervals, id);
		if (this.intervalId !== id) {				
			this.unsetInterval();
			this.intervalId=id;
			
			interval.attachItem(this);
			//после смены интервала надо найти свой период в нем
		}
		this.findPeriod(interval.periodsIds);				
		//console.log(this.intervalId);
		
	}

	findPeriod(ids=null) {
		//если явно не сказали среди каких периодов искать - ищем среди всех
		if (ids===null) {ids=keys(this.context.periods.periods)}

		ids.forEach(t => {
			const period = get(this.context.periods.periods, t);
			if (period.filterItem(this)) {
				this.setPeriod(t);
				return;
			}
		});

		if (this.periodId===null) console.log(this);
	}

	/**
	 * Отстегивает итем от периода и убирает себя из него  (двусторонний разрыв ссылок)
	 */
	unsetPeriod() {
		if (this.periodId !== null) {			//если уже был интервал
			if (has(this.context.periods.periods, this.periodId)) {	//такой интервал есть
				get(this.context.periods.periods, this.periodId)
					.detachItem(this);				//отцепляемся от него
			}
		}
		this.periodId = null;
	}

	setPeriod(id) {
		//if (this.periodId === id) return;		//если ничего не поменялось 
		//(при разбивке недели на дни то что на понедельник не поймет что переехало из недели в день)
		//тут нужен какой-то uid может

		this.unsetPeriod();

		
		//console.log(TimeHelper.strDateTime(this.periodId));
		//console.log(this.context.periods.periods);
		if (id!==null) {
			this.periodId = id;
			get(this.context.periods.periods, this.periodId)
			.attachItem(this);				//прицепляемся к нему
		}
	}



	//перечитать инфу из бэка
	reload() {
		console.log(this);
		this.list.loadItem(this.id);
	}

	/**
	 * Записывает новые значения параметров через action в списке (требование mobx)
	 * @param {*} params 
	 * @param {boolean} save если true, то сохраняет в бэк
	 */
	update(params, save = false, onSuccess = null, onFail = null) {
		params.id = this.id;
		this.list.updateItem(params);
		this.recalcTime();
		if (params.title!==undefined) this.parseTitle();
		if (save) this.save(params, onSuccess, onFail);
	}

	/**
	 * отправить изменения в бэк и перечитать элемент
	 * @param {*} params 
	 * @returns 
	 */
	save(params,onSuccess=null,onFail=null) {
		if (this.isNew) {	//если элемент новый, то передаем все необходимые для создания параметры тоже
			console.log('saving new');
			console.log(this);
			if (params.deadline === undefined)		params.deadline = this.deadline;
			if (params.closedDate === undefined)	params.closedDate = this.closedDate;
			if (params.user === undefined) 			params.user = this.user;
			if (params.title === undefined) 		params.title = this.title;
			if (params.sorting === undefined)		params.sorting = this.sorting;			
		}

		//смена крайнего срока и даты закрытия
		if (params.deadline !== undefined && params.deadline!==null) {
			params.deadline = Math.round((params.deadline - TimeHelper.tzOffest) / 1000) ;
		}

		if (params.closedDate !== undefined && params.closedDate !== null) {
			params.closedDate = Math.round((params.closedDate - TimeHelper.tzOffest) / 1000);
		}

		this.setUpdating(true);

		//сохраняем новые значения
		fetch(this.context.main.apiUrl + this.type + (this.isNew ? '/create/' : '/update/') + this.id, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params)
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.id !== undefined && data.id) {
					const id = Number(data.id);
					if (id !== this.id) {	//сменился ID (новый элемент изначально имеет фейковый ID, потом меняет на реальный)
						//загружаем новый, после загрузки удаляем себя (т.к. временный с фейковым ID)
						this.list.loadItem(id, () => {this.list.deleteItem(this) });
						//оповещаем что надо перечитать новый элемент
						this.list.broadcastUpdate(id);
					} else {
						this.reload();			//перечитываем себя из бэка
						this.broadcastUpdate();	//говорим всем перечитать
					}
					if (onSuccess!==null) onSuccess();
				} else {
					this.setUpdating(false);
					this.alertItem();
					if (onFail !== null) onFail();
					console.log(data);
				}
			})
			.catch((error) => {
				this.setUpdating(false);
				this.alertItem();
				if (onFail !== null) onFail();
				console.log(error)
			});
		return false;
	}

	delete() {
		if (this.isNew)
			this.list.deleteItem(this);
		else {
			this.setUpdating(true);
			//удаляем в бэке
			fetch(this.context.main.apiUrl + this.type + '/delete/' + this.id)
				.then((response) => response.json())
				.then((data) => {
					if (data.result !== undefined && data.result==='ok') {
						this.broadcastRemove();
						this.list.deleteItem(this);
					} else {
						this.setUpdating(false);
						this.alertItem();
						console.log(data);
					}
				})
				.catch((error) => {
					this.setUpdating(false);
					this.alertItem();
					console.log(error)
				});
		}
	}


	//подтвердить новые параметры ячейки (вызывается после d-n-d в другое место) и сохранить их
	movePosition(params) {
		let confirm = [];

		//смена крайнего срока
		if (params.deadline !== undefined && params.deadline !== this.deadline) {
			if (params.deadline === null) {
				confirm.push("Срок выполнения убираем (в долгий ящик)");
			} else {
				confirm.push("Срок выполнения на " + TimeHelper.strDateTimeHumanLong(params.deadline));
			}
		}

		//смена ответственного
		if (params.user !== this.user) {
			const user = this.context.users.getUser(params.user);
			confirm.push("Выставляем ответственным " + user.name);
		}

		if (!this.confirmMove || !confirm.length || window.confirm(confirm.join("\n"))) {
			this.update(params,true);
		}
	}

	startEdit() {
		console.log('start editing ' + this.editField + ' of '+this.uid);
		this.editValue=this[this.editField];
		if (this.editValue === undefined || this.editValue === null) this.editValue='';
		this.setHover(false);
		this.setEdit(true);
	}

	//отмена редактирования
	onCancelEdit = () => {
		const confirmQuestion = this.isNew?this.confirmCancelEditNew:this.confirmCancelEditUpdate;
		if (this.editValue === this[this.editField] || !confirmQuestion || window.confirm(confirmQuestion)) {
			if (this.isNew) 
				this.list.deleteItem(this); 
			else {
				//this.update({ title: this.defaultTitle });
				this.setEdit(false);
			}

		}
			
	};

	//при окончании редактирования
	onCompleteEdit() {
		console.log('complete editing ' + this.editField + ' of ' + this.uid);
		this.setHover(false);
		if (!this.editValue.trim().length && this.deleteOnEmpty) {		//если пусто и мы удаляем пустое
			this.delete();												//то удаляем
			return;														//и все на этом
		}
		this.update(									//обновляем значения элемента
			{ [this.editField]: this.editValue },		//меняем редактируемое поле на значение из редактора
			true,										//и сохраняем
			() => { this.isEdit = false }				//в случае успешного сохранения заканчиваем редактирование
		);
	}

	onLostFocus(){}

	initDefaults(){}

	/**
	 * Присоединиться к хранилищу (обр. ссылка)
	 * @param {} list хранилище элементов этого типа
	 */
	attachList(list) {
		this.list = list;
		this.context = list.getContext();
	}

	recalcTime() {
		const t = this.t;
		if (this.deadline) {
			this.deadlineObj = TimeHelper.objDate(this.deadline);
			this.deadlineStr = this.deadlineObj.D + '.' + this.deadlineObj.M;
			if (this.context.time.year !== this.deadlineObj.Y)
				this.deadlineStr += this.deadlineObj.Y;
		} else this.deadlineStr = 'нет срока';
		
		if (this.closedDate) {
			this.closedDateObj = TimeHelper.objDate(this.closedDate);
			this.closedDateStr = this.closedDateObj.D + '.' + this.closedDateObj.M;
			if (this.context.time.year !== this.closedDateObj.Y)
				this.closedDateStr += this.closedDateObj.Y;
		} else this.closedDateStr = '';

		if (this.closedDate && this.closedDate!==null) {
			this.t = this.closedDate;
			this.isClosed = true;
			this.isOpen = false;
		} else {
			this.t = this.deadline ? Math.max(this.deadline, this.context.time.today) : null;
			this.isClosed = false;
			this.isOpen = true;
		}
		//console.log(this, t);
		if (this.t !== t) this.findInterval();
	}

	/**
	 * Загрузить в элемент JSON данные из битрикс
	 * @param {*} data 
	 */
	loadData(data,recalc=true) {
		if (!Object.keys(data).length) return false;	//нечего грузить
		if (data.ID) this.id = Number(data.ID);
		this.isNew = false;	//загруженный не может быть новым, раз он уже есть в бэке
		if (recalc) this.recalcTime();
		return true;
	}

	/**
	 * Загрузить параметры из другого элемента (или частичного набора параметров)
	 * @param {*} params 
	 */
	init(params,recalc=true) {
		if (!Object.keys(params).length) return false;	//нечего грузить
		Object.keys(params).forEach((attr) => {
			this[attr] = params[attr];
		});

		this.sorting = params.sorting ? params.sorting : TimeHelper.getUnixtime();
		if (recalc) this.recalcTime();
	}


	mouseIn(){
		if (!this.isEdit && !this.isDragging && this && !this.isHovered) this.setHover(true); 
	};

	mouseOut(){
		if (!this.isEdit && !this.isDragging && this.isHovered) this.setHover(false); 
	};

	/**
	 * 
	 * @param {*} item 
	 * @param {*} data 
	 * @param {*} list 
	 */
	constructor(item,data,list) {
		this.attachList(list);
		this.initDefaults();
		if (item.id) this.id = item.id;
		if (data.ID) this.id = Number(data.ID);
		this.uid = this.type + ':' + this.id;

		this.init(item,false);
		this.loadData(data,false);
		this.recalcTime();

		makeObservable(this,{
			title:observable,
			user:observable,

            deadline:observable,
            closedDate:observable,
			t: observable,

            isClosed:observable,
            isNow:observable,
        
            sorting:observable,
        
            favorite:observable,
        
            isUpdating:observable,
			isAlert: observable,
			isFlash: observable,
            isHovered:observable,
            isHoveredParent:observable,
            isHoveredChild:observable,
			isExpanded:observable,
                    
            setUpdating:action,
            setAlert:action,
			setFlash:action,
            setDragging:action,
			setHover: action,
			setParentHover: action,
			setChildHover: action,
			setEdit: action,
			setExpanded: action,

			addParent:action,
			addChild:action,
			removeParent:action,
			removeChild:action,

			isDragging: observable,
			isEdit: observable,
		})

		//console.log(this);
    }
}

Object.assign(DashItem.prototype,RelativesMixin);


/**
 * Возвращает индекс сортировки закрытого элемента
 * @param item
 */
function dashClosedItemSortIndex(item) {
	if (item.type === 'plan') return 120;
	if (item.type === 'task') return 100;
    if (item.type==='ticket') return 80;
    if (item.type==='job') return 60;
    return 0;
}

/**
 * Сортировка закрытых элементов (такая логика годится только для закрытых)
 * Давайте попробуем придерживаться такой логики:
 * Сначала задачи, потом тикеты, потом работы
 * Элемент без даты идет позже элемента с датой
 */
export function dashClosedItemsSort(a,b) {
    let sortingA=dashClosedItemSortIndex(a);
    let sortingB=dashClosedItemSortIndex(b);
    if (sortingA===sortingB) {
		if (a.id === b.id) return 0;
		return a.id < b.id ? 1 : -1;
        //return canBanSortItemsByDate(b,a);
    }
    //console.log(sortingA+" vs "+sortingB);
    return (sortingA > sortingB) ? 1:-1;
}

//Сравнение элементов по индексу сортировки
export function dashItemsSort(a,b) {
	//console.log(typeof a.sorting + a.sorting);
	//console.log(typeof b.sorting + b.sorting);
	if (a.type === 'ticket' && b.type === 'ticket') {
		if (a.id === b.id) return 0;
		return a.id < b.id ? 1 : -1;
	}

	if (a.type === 'ticket' || b.type === 'ticket') {
		return a.type === 'ticket' ? 1 : -1;
	}

    if (a.sorting===b.sorting) {
        //по индексу одинаковые - сравним по времени
        if (a.t === b.t) {
            //по времени одинаковые - сравним по ID
            if (a.id === b.id) return 0;
            return a.id < b.id? 1 : -1;
        }
        if (b.t === null) return 1; //У B нет даты, потому он "позже"
        if (a.t === null) return -1; //У A нет даты, потому он "позже"
        return (a.t < b.t)? 1: -1;
    };
    return (a.sorting>b.sorting)? 1 : -1;
}

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
    if (edge==='bottom') neighbour++;
    console.log('inserting ite between '+index+' & '+neighbour
        +' sort of '+Math.min(list[index].sorting,list[neighbour].sorting)+' and '+Math.max(list[index].sorting,list[neighbour].sorting));
    return Math.round((list[index].sorting + list[neighbour].sorting)/2);
}

function dashItemDropOnItem(item,targetItem,targetCell,sourceCell) {
    // нам надо сравнивать не t задачи и t новой ячейки (они сроду не совпадут), а t старой ячейки и t новой
    // для новой сортировки нам надо надыбать полный список в новой ячейке, чтобы понять между какими сорт-индексами брошена ячейка
    console.log('Dropping on item'); 
    //console.log(item);
    //console.log(targetItem);
    //console.log(targetCell);
    //console.log(sourceCell);
    const edge=extractClosestEdge(targetItem.data);
    if (edge===undefined) {
        console.log('Cant find target item edge. Halt DND!');
        return;
    }

    const index=targetItem.data.index;
    if (index===undefined) {
        console.log('Cant find target item index. Halt DND!');
        return;
    }

    const targetList=targetCell.data.items;
    if (targetList===undefined) {
        console.log('Cant find target cell items list. Halt DND!');
        return;
    }

    const sourceList=sourceCell.data.items;
    if (sourceList===undefined) {
        console.log('Cant find source cell items list. Halt DND!');
        return;
    }

    console.log(sourceList);
    const oldIndex=sourceList.findIndex((i)=>i.uid===item.uid)
    if (oldIndex===-1) {
        console.log('Cant find myself in source cell. Halt DND!');
        return;
    }

    console.log('shifting '+oldIndex+' => '+index+' ('+edge+')');
    console.log(sourceCell.data.cell.id +'==>'+ targetCell.data.cell.id)

    //если DND внутри одной ячейки (то возможна только сортировка)
    if (
        targetCell.data.cell.id === sourceCell.data.cell.id 
        && 
        (
            index===oldIndex 
            || 
            (index===oldIndex+1 && edge==='top') 
            ||
            (index===oldIndex-1 && edge==='bottom') 
        )
    ) {
        console.log ('Droped on itself. nothing to do');
        return;            
    }

    let newParams={
		deadline: item.deadline,
        user:item.user,
        sorting:item.sorting
    };

    const newSort=dashItemNewSort(item,targetList,index,edge);
    console.log('sort: '+item.sorting+' => '+newSort);
    if (newSort!==item.sorting) {
        console.log('changing sort: '+item.sorting+' => '+newSort);
        newParams.sorting=newSort;
    }

    if (targetCell.data.cell.t !== sourceCell.data.cell.t) {
        console.log('changing time => '+targetCell.data.cell.dropT);
		newParams.deadline =targetCell.data.cell.dropT;
    }

    if (targetCell.data.cell.user !== sourceCell.data.cell.user) {
        console.log('changing user => '+targetCell.data.cell.user);
        newParams.user=targetCell.data.cell.user
    }

    item.movePosition(newParams);
}

function dashItemDropOnCell(item,targetCell,sourceCell) {
    // нам надо сравнивать не t задачи и t новой ячейки (они сроду не совпадут), а t старой ячейки и t новой
    // для новой сортировки нам надо надыбать полный список в новой ячейке, чтобы понять между какими сорт-индексами брошена ячейка
    console.log('Dropping on Cell'); 
    //console.log(item);
    //console.log(targetCell);
    //console.log(sourceCell);

    const targetList=targetCell.data.items;
    if (targetList===undefined) {
        console.log('Cant find target cell items list. Halt DND!');
        return;
    }
    const index=targetList.length;

    const sourceList=sourceCell.data.items;
    if (sourceList===undefined) {
        console.log('Cant find source cell items list. Halt DND!');
        return;
    }

    //console.log(sourceList);
    const oldIndex=sourceList.findIndex((i)=>i.uid===item.uid)
    if (oldIndex===-1) {
        console.log('Cant find myself in source cell. Halt DND!');
        return;
    }

    console.log(sourceCell.data.cell.id +'==>'+ targetCell.data.cell.id)
    console.log('shifting '+oldIndex+' => '+index);

    
    if (
        targetCell.data.cell.id === sourceCell.data.cell.id  //если DND внутри одной ячейки (то возможна только сортировка)
        &&  
        index-1 === oldIndex //если был и так последним в списке (index===length)
    ) {
        console.log ('Droped on itself. nothing to do');
        return;            
    }

    let newParams={
		deadline: item.deadline,
        user: item.user,
        sorting: item.sorting
    };

    const newSort=index?targetList[index-1].sorting-100:item.sorting;
    console.log('sort: '+item.sorting+' => '+newSort);
    if (newSort!==item.sorting) {
        console.log('changing sort: '+item.sorting+' => '+newSort);
        newParams.sorting=newSort;
    }

    if (targetCell.data.cell.t !== sourceCell.data.cell.t) {
        console.log('changing time => '+targetCell.data.cell.dropT);
		newParams.deadline =targetCell.data.cell.dropT;
    }

    if (targetCell.data.cell.user !== sourceCell.data.cell.user) {
        console.log('changing user => '+targetCell.data.cell.user);
        newParams.user=targetCell.data.cell.user
    }

    item.movePosition(newParams);

}

/**
 * Общий вызов когда карточку бросили кудато
 * @param {*} item карточка
 * @param {*} location кудато
 * @returns 
 */
export function dashItemsDrop(item,location) {
    //console.log(location);

    const sourceCell=location.initial.dropTargets.find((source)=>source.data.type==='cell');
    if (sourceCell===undefined) {
        console.log ('Cant find source cell. Halt DND!');
        return;
    }

    const targetCell=location.current.dropTargets.find((target)=>target.data.type==='cell');
    if (targetCell===undefined) {
        console.log ('Cant find target cell. Halt DND!');
        return;
    }

    const targetItem=location.current.dropTargets.find((target)=>target.data.type==='item');
    if (targetItem!==undefined) {
        dashItemDropOnItem(item,targetItem,targetCell,sourceCell);
    } else if (targetCell!==undefined) {
        console.log('Dropping on cell');
        dashItemDropOnCell(item,targetCell,sourceCell);
    } else {
        console.log('No valid drop target');
    }
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
        console.log(dropData.item.uid+': '+cellId(cell)+' saved');
    }
    //console.log(dropData.item);
    
	
	
    return combine(
		//для того чтобы элемент можно было таскать
		draggable({
			element: element,
			getInitialData: () => {return{setCell: setCell}},
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
                return dropData.item.isDraggable && source.element !== dropData.element;
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

