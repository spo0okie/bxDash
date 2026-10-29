import { observable, action, makeObservable, get } from 'mobx';
import TimeHelper from "Helpers/TimeHelper";
import notify from "Helpers/Notify";
import { bxJson } from "Helpers/BxJson";
import RelativesMixin from './Mixins/RelativesMixin';

/** Человеческие названия типов — для текстов уведомлений */
const TYPE_LABELS = {
	task: 'Задача',
	job: 'Работа',
	ticket: 'Заявка',
	plan: 'План',
	memo: 'Заметка',
};

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

 	/** Приоритет элемента для разделения долгого ящика на три приоритета:
 	  * 1 - низкий приоритет (верхняя часть долгого ящика)
 	  * 2 - средний приоритет (средняя часть долгого ящика) - значение по умолчанию
 	  * 3 - высокий приоритет (нижняя часть долгого ящика)
 	  */
 	priority = 1;		//средний приоритет по умолчанию

 	setPriority(value) {
 		this.priority = value;
 	}

	/**
	 * Явные привязки к столбцам канбан-досок: {userId: stageId}.
	 * У каждого пользователя своя доска, поэтому привязка — на пару элемент+пользователь.
	 * Нет записи для пользователя — элемент лежит в его столбце по умолчанию.
	 * Объект заменяется целиком (observable.ref).
	 */
	stages = {};

	/** Заменить все привязки (данные бэка: поле STAGES) */
	setStages(map) {
		const next = {};
		Object.entries(map ?? {}).forEach(([userId, stageId]) => {
			if (Number(userId) && Number(stageId)) next[Number(userId)] = Number(stageId);
		});
		this.stages = next;
	}

	/** Привязать к столбцу на доске пользователя; stageId null — снять привязку (в столбец по умолчанию) */
	setStage(userId, stageId) {
		userId = Number(userId);
		if (!userId) return;
		const next = { ...this.stages };
		if (stageId === null || stageId === undefined) delete next[userId];
		else next[userId] = Number(stageId);
		this.stages = next;
	}

	/**
	 * В каком столбце элемент лежит на доске пользователя.
	 * Явная привязка, а если её нет или такого столбца у пользователя уже нет — столбец по умолчанию.
	 * @returns {number|null} id столбца; null — столбцы пользователя ещё не загружены
	 */
	stageFor(userId) {
		userId = Number(userId);
		const store = this.context?.stages;
		if (!store) return null;
		const explicit = this.stages[userId];
		if (explicit !== undefined && store.hasStage(userId, explicit)) return explicit;
		return store.defaultStageOf(userId)?.id ?? null;
	}


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
		if (this.isHovered===value) return;
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

	/** Подпись элемента для уведомлений: "Задача 123" / "Задача (новая)" */
	get label() {
		return (TYPE_LABELS[this.type] ?? this.type) + (this.isNew ? ' (новая)' : ' ' + this.id);
	}

	/**
	 * Запрос к бэку Bitrix, возвращающий распарсенный JSON.
	 * Бросает Error с человекочитаемым текстом, если: HTTP-ошибка, ответ не JSON
	 * (например HTML PHP fatal), или бэк вернул {result:'error', error:...}.
	 */
	bxJson(endpoint, options = {}) {
		return bxJson(this.context.main.bx, endpoint, options);
	}

	/**
	 * Общая реакция на неудачную операцию с бэком: снять спиннер, мигнуть карточкой,
	 * показать красное уведомление с причиной.
	 * @param {string} action что делали ("сохранение", "удаление"...)
	 * @param {*} error Error / ответ бэка / текст
	 */
	reportFail(action, error) {
		this.setUpdating(false);
		this.alertItem();
		console.log(error);
		notify.error(notify.describe(error), { title: this.label + ': ' + action + ' не удалось' });
	}


	//перечитать инфу из бэка
	reload() {
		//console.log(this);
		this.list.loadItem(this.id);
	}

	/**
	 * Записывает новые значения параметров через action в списке (требование mobx)
	 * @param {*} params
	 * @param {boolean} save если true, то сохраняет в бэк
	 */
	update(params, save = false, onSuccess = null, onFail = null) {
		params.id = this.id;
		//столбец канбана — не поле элемента, а привязка на доске пользователя stageUser:
		//локально кладём её в stages, в бэк параметры уйдут как есть (см. save)
		const fields = { ...params };
		if (fields.stage !== undefined) {
			this.setStage(fields.stageUser, fields.stage);
			delete fields.stage;
		}
		delete fields.stageUser;
		this.list.updateItem(fields);
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
			if (params.priority === undefined)		params.priority = this.priority;
			if (this.startDatePlan !== undefined && params.startDatePlan === undefined)
				params.startDatePlan = this.startDatePlan;
			//элемент создан в столбце канбана — передаём привязку, чтобы он сохранился в этом столбце
			const boards = Object.keys(this.stages);
			if (params.stage === undefined && boards.length) {
				params.stageUser = Number(boards[0]);
				params.stage = this.stages[boards[0]];
			}
		}

		//смена крайнего срока и даты закрытия
		if (params.deadline !== undefined && params.deadline!==null) {
			params.deadline = Math.round((params.deadline - TimeHelper.mskOffsetMs) / 1000) ;
		}

		if (params.startDatePlan !== undefined && params.startDatePlan !== null) {
			params.startDatePlan = Math.round((params.startDatePlan - TimeHelper.mskOffsetMs) / 1000);
		}

		if (params.closedDate !== undefined && params.closedDate !== null) {
			params.closedDate = Math.round((params.closedDate - TimeHelper.mskOffsetMs) / 1000);
		}

		this.setUpdating(true);

		//сохраняем новые значения
		const wasNew = this.isNew;
		this.bxJson(this.type + (this.isNew ? '/create/' : '/update/') + this.id, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params)
		})
			.then((data) => {
				if (!data.id) throw new Error('Сервер не вернул id: ' + notify.describe(data));
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
			})
			.catch((error) => {
				this.reportFail(wasNew ? 'создание' : 'сохранение', error);
				//локально поля уже поменяны (оптимистично) — откатываемся к состоянию бэка,
				//иначе карточка "как будто" сохранилась до следующей перезагрузки
				if (!wasNew) this.reload();
				if (onFail !== null) onFail();
			});
		return false;
	}

	delete() {
		if (this.isNew)
			this.list.deleteItem(this);
		else {
			this.setUpdating(true);
			//удаляем в бэке
			this.bxJson(this.type + '/delete/' + this.id)
				.then((data) => {
					if (data.result !== 'ok') throw new Error(notify.describe(data));
					this.broadcastRemove();
					this.list.deleteItem(this);
				})
				.catch((error) => this.reportFail('удаление', error));
		}
	}


	//подтвердить новые параметры ячейки (вызывается после d-n-d в другое место) и сохранить их
	movePosition(params) {
		const confirm = [];	//вопрос перед сохранением
		const done = [];	//что сообщить после успешного сохранения

		//смена крайнего срока
		if (params.deadline !== undefined && params.deadline !== this.deadline) {
			if (params.deadline === null) {
				confirm.push("Срок выполнения убираем (в долгий ящик)");
				done.push("Срок выполнения убран (в долгий ящик)");
			} else {
				const str = TimeHelper.strDateTimeHumanLong(params.deadline);
				confirm.push("Срок выполнения на " + str);
				done.push("Срок выполнения: " + str);
			}
		}

		//смена запланированной даты (для задач — это основной атрибут календаря)
		if (params.startDatePlan !== undefined && params.startDatePlan !== this.startDatePlan) {
			if (params.startDatePlan === null) {
				confirm.push("Запланировано: убираем (в долгий ящик)");
				done.push("Плановая дата убрана (в долгий ящик)");
			} else {
				const str = TimeHelper.strDateTimeHumanLong(params.startDatePlan);
				confirm.push("Запланировано на " + str);
				done.push("Запланировано на " + str);
			}
		}

		//смена ответственного
		if (params.user !== undefined && params.user !== this.user) {
			const user = get(this.context.users.items, params.user);
			const name = user?.name ?? ('пользователь ' + params.user);
			confirm.push("Выставляем ответственным " + name);
			done.push("Ответственный изменён: " + name);
		}

		if (
			!this.confirmMove
			||
			!confirm.length
			||
			window.confirm(confirm.join("\n"))
		) {
			//простую пересортировку внутри ячейки не озвучиваем — это шум
			const label = this.label;
			const onSuccess = done.length
				? () => notify.success(done.join("\n"), { title: label })
				: null;
			this.update(params, true, onSuccess);
		}
	}

	startEdit() {
		this.editValue=this[this.editField];
		console.log(this);
		console.log('start editing ' + this.editField + ' of ' + this.uid + ': ' + this.editValue);
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
		if (this.deadline) {
			this.deadlineObj = TimeHelper.objDate(this.deadline);
			this.deadlineStr = this.deadlineObj.D + '.' + this.deadlineObj.M;
			if (this.context.time.year !== this.deadlineObj.Y)
				this.deadlineStr += this.deadlineObj.Y;
		} else this.deadlineStr = '∞';

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
	}

	/**
	 * Загрузить в элемент JSON данные из битрикс
	 * @param {*} data
	 */
	loadData(data,recalc=true) {
		if (!Object.keys(data).length) return false;	//нечего грузить
		if (data.ID) this.id = Number(data.ID);
		if (data.STAGES !== undefined) this.setStages(data.STAGES);
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
	 * Создает новый элемент
	 * @param {*} item DashItem элемент того же класса с начальными параметрами
	 * @param {*} data Bitrix данные для загрузки
	 * @param {*} list Store в который добавляется элемент
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
  			priority: observable,
  			stages: observable.ref,
  			setStages: action,
  			setStage: action,

  			setUpdating:action,
  			setAlert:action,
  			setFlash:action,
  			setDragging:action,
  			setHover: action,
  			setParentHover: action,
  			setChildHover: action,
  			setEdit: action,
  			setExpanded: action,
  			setPriority: action,
  			recalcTime: action,

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
