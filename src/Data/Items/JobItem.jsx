import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class JobItem extends DashItem {
	initDefaults() {
		this.type = 'job';		//тип
		this.confirmMove = false;
		this.confirmCancelEditNew = 'Отменить создание записи о работе?';		//какой вопрос задавать если нажали ESC при создании (редактировании текста) нового элемента (не задавать вопрос если пусто)
		this.confirmCancelEditUpdate = 'Отменить изменения?';	//какой вопрос задавать если нажали ESC при редактировании сузествующего элемента (не задавать вопрос если пусто)
		this.titleLinks='parentUids';
	}

	onLostFocus() {
		console.log('lost focus');
		this.onCompleteEdit();
	}

	completionToggle() {
		if (this.isClosed && window.confirm('Вернуть в работу?')) {
			this.setHover(false);	//мышка удет на модальное окно, но евент об этом не прилетит
			this.update({ closedDate: null, deadline: TimeHelper.getTimestamp() }, true);
		} else
			this.update({ closedDate: TimeHelper.getTimestamp() }, true);
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
		if (!super.loadData(item,false)) return false;

		this.deadline=item.DATE_ACTIVE_FROM?TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_FROM):null;

		this.closedDate=TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_TO);
		
		this.createdAt=TimeHelper.bitrixDateTimeToJs(item.CREATED_DATE);

		this.sorting=Number(item.SORT);
	
		this.title=item['~PREVIEW_TEXT'];

        this.user=Number(item.PROPERTY_USER_VALUE);

		this.childUids=[];
		this.parentUids=[];

		this.parseTitle();

		this.setUpdating(false);
		this.recalcTime();
		//console.log(this);
	}


}
export default JobItem;