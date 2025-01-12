import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class AbsentItem extends DashItem {
	initDefaults() {
		this.type = 'absent';		//тип
	}

	/**
	 * Инициализация
	 * @param {*} item 
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item){
		console.log(item);
		if (!super.loadData(item)) return false;

		this.createdAt =TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_FROM);
		this.closedDate=TimeHelper.bitrixDateTimeToJs(item.DATE_ACTIVE_TO);
        this.user=Number(item.PROPERTY_USER_VALUE);

		this.setUpdating(false);
	}


}
export default AbsentItem;