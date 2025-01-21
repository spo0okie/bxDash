import { observable, keys, action, makeObservable, get, has} from 'mobx';
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
			//console.log(this);
			const user = get(this.context.users.items,params.user);
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
