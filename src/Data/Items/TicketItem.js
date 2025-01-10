import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class TicketItem extends DashItem {

	initDefaults() {
		this.type = 'ticket';		//тип
		this.isUnmovable = true;
	}

	recalcTime() {
		const t = this.t;

		this.isNow = !this.isClosed && !this.isOnHold;		//в работе, если не закрыта и не отложена

		if (this.isNow) {
			this.t=this.context.time.today;
		} else {
			if (this.isClosed) {
				this.t = this.closedDate;
			} else {
				this.t = this.isOnHold?null:this.deadline;
			}
		}

		if (this.t !== t) this.findInterval();
	}

	/**
	 * Инициализация
	 * @param {*} item 
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item, recalc) {
    //    console.log(item)
		if (!super.loadData(item)) return false;


		this.user = Number(item.RESPONSIBLE_USER_ID);		

		this.status = item.LAMP === 'green' || item.LAMP === 'green_s'?'green':'red';
		this.strStatus = item.STATUS_NAME;
		this.deadline = item.DEADLINE_SOURCE_DATE ? TimeHelper.bitrixDateTimeToJs(item.DEADLINE_SOURCE_DATE) : null;
		this.isOnHold=(item.HOLD_ON === 'Y');
		this.lastMessageBySupportTeam = (item.LAST_MESSAGE_BY_SUPPORT_TEAM === 'Y');
		this.closedDate = TimeHelper.bitrixDateTimeToJs(item.LAST_MESSAGE_DATE);

		let names = item.OWNER_NAME.trim();
		if ( names.length && 2 in names.split(' ')) {
			this.title = names.split(' ')[2] + ': ' + item.TITLE;
		} else this.title = item.TITLE;



		if (
			(this.strStatus === 'Успешно решено' || this.strStatus === 'Не представляется возможным решить') 
			&& 
			this.status==='green' 
			&& 
			!this.isOnHold
			&&
			this.lastMessageBySupportTeam
		) {
			this.status='blue';
		}

		this.isClosed = Boolean(item.DATE_CLOSE) || this.status === 'blue';
		
		this.createdAt = TimeHelper.bitrixDateTimeToJs(item.DATE_CREATE);

		this.viewUrl = '/bitrix/admin/ticket_edit.php?ID='+this.id;

		if (recalc) this.recalcTime();
		this.setUpdating(false);
		return true;
	}

}
export default TicketItem;