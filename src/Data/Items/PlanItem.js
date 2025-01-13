import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class PlanItem extends DashItem {
	authStatus;
	authUser;
	comments;
	initDefaults() {
		this.type = 'plan';		//тип
		this.confirmMove = false;
		this.confirmCancelEditNew = 'Отменить новый план?';		//какой вопрос задавать если нажали ESC при создании (редактировании текста) нового элемента (не задавать вопрос если пусто)
		this.confirmCancelEditUpdate = 'Отменить изменения?';	//какой вопрос задавать если нажали ESC при редактировании сузествующего элемента (не задавать вопрос если пусто)
		this.isUnmovable = true;
	}

	onLostFocus() {
		console.log('lost focus');
		this.onCompleteEdit();
	}

	recalcTime() {
		const t = this.t;
		this.deadlineStr = this.deadline ? TimeHelper.strDateTime(this.deadline) : 'нет срока????'; //план запрещено создавать в долгом ящике. двигать сроки тоже нельзя
		this.closedDateStr = this.closedDate ? TimeHelper.strDateHuman(this.closedDate) : '';
		this.t = this.deadline;
		//console.log(this, t);
		if (this.t !== t) this.findInterval();
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
		//console.log(item.DATE_ACTIVE_FROM);
		this.deadline=TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_FROM);//-10000000;

		this.closedDate=TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_TO);
		
		this.createdAt=TimeHelper.bitrixDateTimeToJs(item.CREATED_DATE);

		this.sorting=Number(item.SORT);
	
		this.title = item['~PREVIEW_TEXT'];
		this.comments = item['~DETAIL_TEXT'];

        this.user=Number(item.PROPERTY_USER_VALUE);
		this.authorized = item.PROPERTY_AUTHORIZED_VALUE?Number(item.PROPERTY_AUTHORIZED_VALUE):null;
		this.status = Number(item.PROPERTY_STATUS_VALUE);
		this.authStatus = Number(item.PROPERTY_AUTHSTATUS_VALUE);

		if (isNaN(this.status)) this.status = 0;
		if (isNaN(this.authStatus)) this.authStatus = 0;
		if (this.authStatus) {		//в утвержденных планах
			this.editField='comments';	//правим только комментарии
			this.deleteOnEmpty=false;	//при удалении комментария план не удаляем
		} else {					//в неутвержденных
			this.editField = 'title';	//правим сам план
			this.deleteOnEmpty = true;	//при удалении текста плана удаляем весь элемент
		}

		this.recalcTime();
		this.parseTitle();
		this.setUpdating(false);
	}


}
export default PlanItem;