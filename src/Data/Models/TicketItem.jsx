import { action, computed, makeObservable, observable } from "mobx";
import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";
import { ticketSlaWorkDays } from "config.priv";

class TicketItem extends DashItem {
	
	owner = null;        // автор заявки (OWNER_USER_ID)
	message = '';         // сообщение (остальной текст после заголовка)

	initDefaults() {
		this.type = 'ticket';		//тип
		this.isUnmovable = true;
		this.editField = 'ticketText';  // кастомное поле для редактирования
		this.defaultTitle = 'Новая заявка\nОписание заявки';
		this.title = this.defaultTitle;
		this.priority = 2; // по умолчанию - высокий
	}

	recalcTime() {
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
	}

	/**
	 * Инициализация на данных из Bitrix
	 * @param {*} item 
	 * @param {*} recalc 
	 */
	loadData(item, recalc) {
		if (!super.loadData(item)) return false;

		this.user = Number(item.RESPONSIBLE_USER_ID);		
		this.owner = Number(item.OWNER_USER_ID);

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

	/**
	 * Переопределяем save() для специфичного формата данных тикета
	 * Используем стандартный механизм DashItem.save() но с кастомными параметрами
	 */
	save(params, onSuccess = null, onFail = null) {
		// Формируем текст из title и message
		const text = this.title + '\n' + this.message;
		
		const ticketParams = {
			text: text,
			owner: this.owner,
			responsible: this.user,
		};

		this.setUpdating(true);

		// Используем стандартный механизм но с кастомным URL и параметрами
		this.context.main.bx.fetch(this.type + '/create/' + this.id, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(ticketParams)
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.id !== undefined && data.id) {
					const id = Number(data.id);
					// Стандартная логика: загружаем новый, удаляем временный
					this.list.loadItem(id, () => { this.list.deleteItem(this) });
					this.list.broadcastUpdate(id);
					if (onSuccess !== null) onSuccess();
				} else {
					this.setUpdating(false);
					this.alertItem();
					if (onFail !== null) onFail();
				}
			})
			.catch((error) => {
				this.setUpdating(false);
				this.alertItem();
				if (onFail !== null) onFail();
				console.error('Error creating ticket:', error);
			});
	}

	/**
	 * Активен ли SLA-таймер.
	 * Тикет «в работе» = не закрыт, не отложен, не ожидает закрытия (status==='blue').
	 * isClosed уже включает blue, но проверяем явно — на случай рассинхрона флагов.
	 */
	get isSlaActive() {
		return !this.isClosed && !this.isOnHold && this.status !== 'blue';
	}

	/**
	 * Крайний срок SLA в мс (реальный Unix-таймстамп) или null, если не применим.
	 * Реактивный по schedule.compiled — при изменении расписания пересчитается.
	 */
	get slaDeadlineMs() {
		const schedule = this.context?.schedule;
		if (!schedule) return null;
		if (!this.createdAt) return null;
		if (!this.isSlaActive) return null;
		return schedule.addWorkDays(this.createdAt, ticketSlaWorkDays);
	}

	/**
	 * Сколько нерабочих календарных дней пришлось на интервал
	 * [createdAt..slaDeadlineMs]. Для подсказки на TicketCard.
	 */
	get slaNonWorkDays() {
		const schedule = this.context?.schedule;
		const deadline = this.slaDeadlineMs;
		if (!schedule || !deadline) return 0;
		return schedule.countNonWorkDays(this.createdAt, deadline);
	}

	constructor(item, data, list) {
		super(item, data, list);

		makeObservable(this, {
			owner: observable,
			message: observable,
			isSlaActive: computed,
			slaDeadlineMs: computed,
			slaNonWorkDays: computed,
		});
	}
}

export default TicketItem;
