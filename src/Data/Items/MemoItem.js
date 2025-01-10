import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class MemoItem extends DashItem {
	text;

	initDefaults() {
		this.type = 'memo';		//тип
		this.confirmMove = false;
		this.confirmCancelEditNew = 'Отменить новую заметку?';		//какой вопрос задавать если нажали ESC при создании (редактировании текста) нового элемента (не задавать вопрос если пусто)
		this.confirmCancelEditUpdate = 'Отменить изменения?';	//какой вопрос задавать если нажали ESC при редактировании сузествующего элемента (не задавать вопрос если пусто)
		this.editField='text';
		this.linksAttr='text';
		this.text='';
		this.isUnmovable = false;
		this.isExpanded = false;
	}
	parseTaskReplace(match) {return '[TaskLink]('+match[2]+')';}

	onLostFocus() {
		this.onCompleteEdit();
	}

	isDraggable(cell) {
		//return true;
		return !this.isClosed   //закрытые не таскаем
		&& !this.isUpdating     //обновляемые тоже
		&& !this.isNew          //и не создание нового элемента
		&& !this.isEdit;          //и не создание нового элемента
	}

	recalcTime() {
		//const t = this.t;
		this.deadlineStr = this.deadline ? TimeHelper.strDateTime(this.deadline) : 'нет срока';
		this.closedDateStr = this.closedDate ? TimeHelper.strDateHuman(this.closedDate) : '';
		this.t = this.deadline;
		this.isClosed=(this.closedDate!==null);
		this.isOpen=!this.isClosed;
		console.log(this.isClosed,this.isOpen);
		//if (this.t !== t) this.findInterval();
	}

	setHover(value) {
		this.isHovered=value;
		this.children.forEach(children => children.setHover(value));
		this.list.activityUpdate();
		return this;
	}	
	
	/**
	 * Инициализация
	 * @param {*} item 
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item){
		//console.log(item);
		//console.log(this);
		if (!super.loadData(item)) return false;

		this.deadline=item.DATE_ACTIVE_FROM?TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_FROM):null;

		this.closedDate=TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_TO);
		
		this.createdAt=TimeHelper.bitrixDateTimeToJs(item.CREATED_DATE);

		this.sorting=Number(item.SORT);
	

		this.text = item['~DETAIL_TEXT'];
		this.title = this.text.split("\n")[0];

		this.parseTitle();

		this.setUpdating(false);
	}


}
export default MemoItem;