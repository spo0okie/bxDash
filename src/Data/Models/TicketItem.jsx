import { action, computed, makeObservable, observable } from "mobx";
import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";
import { ticketWorkTime } from 'Helpers/TicketWorkTime';
import notify from "Helpers/Notify";
import { ticketSlaWorkDays } from "config.priv";

class TicketItem extends DashItem {
	owner = null; // автор заявки (OWNER_USER_ID)
	message = ""; // сообщение (остальной текст после заголовка)
	category = null; // категория при создании; существующие заявки здесь не редактируются

	initDefaults() {
		// Базовый конструктор вызывает loadData: поле не должно перезаписываться после super().
		this.holdIntervals = [];
		this.type = "ticket"; //тип
		this.isUnmovable = true;
		this.editField = "ticketText"; // кастомное поле для редактирования
		this.defaultTitle = "Новая заявка\nОписание заявки";
		this.title = this.defaultTitle;
		this.priority = 2; // по умолчанию - высокий
	}

	recalcTime() {
		this.isNow = !this.isClosed && !this.isOnHold; //в работе, если не закрыта и не отложена

		if (this.isNow) {
			this.t = this.context.time.today;
		} else {
			if (this.isClosed) {
				this.t = this.closedDate;
			} else {
				this.t = this.isOnHold ? null : this.deadline;
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

		this.status =
			item.LAMP === "green" || item.LAMP === "green_s" ? "green" : "red";
		this.strStatus = item.STATUS_NAME;
		this.deadline = item.DEADLINE_SOURCE_DATE
			? TimeHelper.bitrixDateTimeToJs(item.DEADLINE_SOURCE_DATE)
			: null;
		this.isOnHold = item.HOLD_ON === "Y";
		// Старый бэкенд без истории сохраняет прежний расчёт до обновления API.
		this.holdIntervals = (item.HOLD_INTERVALS ?? []).map(interval => ({
			start: TimeHelper.bitrixDateTimeToJs(interval.START),
			end: interval.END ? TimeHelper.bitrixDateTimeToJs(interval.END) : null,
		}));
		this.lastMessageBySupportTeam = item.LAST_MESSAGE_BY_SUPPORT_TEAM === "Y";
		this.closedDate = TimeHelper.bitrixDateTimeToJs(item.LAST_MESSAGE_DATE);

		let names = item.OWNER_NAME.trim();
		if (names.length && 2 in names.split(" ")) {
			this.title = names.split(" ")[2] + ": " + item.TITLE;
		} else this.title = item.TITLE;

		// LAMP зависит от просматривающего пользователя, поэтому не определяет автозакрытие.
		// Старый API без ID статуса и срока поддерживаем до обновления бэкенда.
		const isResolved = item.STATUS_ID === undefined
			? this.strStatus === 'Успешно решено' || this.strStatus === 'Не представляется возможным решить'
			: Number(item.STATUS_ID) === 9 || Number(item.STATUS_ID) === 10;
		const hasAutoClose = item.AUTO_CLOSE_DAYS === undefined || Number(item.AUTO_CLOSE_DAYS) > 0;
		if (
			isResolved && hasAutoClose && !item.DATE_CLOSE &&
			!this.isOnHold &&
			this.lastMessageBySupportTeam
		) {
			this.status = "blue";
		}

		this.isClosed = Boolean(item.DATE_CLOSE) || this.status === "blue";

		this.createdAt = TimeHelper.bitrixDateTimeToJs(item.DATE_CREATE);

		this.viewUrl = "/bitrix/admin/ticket_edit.php?ID=" + this.id;

		if (recalc) this.recalcTime();
		this.setUpdating(false);
		return true;
	}

	/**
	 * Переопределяем save() для специфичного формата данных тикета
	 * Используем стандартный механизм DashItem.save() но с кастомными параметрами
	 */
	save(params, onSuccess = null, onFail = null) {
		// Существующую заявку дашборд не редактирует (она ведётся в техподдержке).
		// Единственное, что сохраняется — столбец канбан-доски: ticket/update принимает только его.
		if (!this.isNew) {
			if (params.stage === undefined) {
				notify.warning('Заявки из дашборда не редактируются — изменение не сохранено', { title: this.label });
				if (onFail !== null) onFail();
				return false;
			}
			return super.save({ id: this.id, stage: params.stage, stageUser: params.stageUser }, onSuccess, onFail);
		}

		// Формируем текст из title и message
		const text = this.title + "\n" + this.message;

		const ticketParams = {
			text: text,
			owner: this.owner,
			responsible: this.user,
		};
		// Отсутствие выбора у старых вызовов сохраняет серверное значение по умолчанию.
		if (this.category !== null) ticketParams.category = this.category;

		this.setUpdating(true);

		// Используем стандартный механизм но с кастомным URL и параметрами
		this.bxJson(this.type + "/create/" + this.id, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(ticketParams),
		})
			.then((data) => {
				if (!data.id) throw new Error("Сервер не вернул id заявки");
				const id = Number(data.id);
				// Стандартная логика: загружаем новый, удаляем временный
				this.list.loadItem(id, () => {
					this.list.deleteItem(this);
				});
				this.list.broadcastUpdate(id);
				if (onSuccess !== null) onSuccess();
			})
			.catch((error) => {
				this.reportFail("создание", error);
				if (onFail !== null) onFail();
			});
	}

	/**
	 * Активен ли SLA-таймер.
	 * Тикет «в работе» = не закрыт, не отложен, не ожидает закрытия (status==='blue').
	 * isClosed уже включает blue, но проверяем явно — на случай рассинхрона флагов.
	 */
	get isSlaActive() {
		return !this.isClosed && !this.isOnHold && this.status !== "blue";
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
	 * Остаток до крайнего срока SLA в мс (отрицательный — просрочено).
	 * Подписан на time.strTime, поэтому пересчитывается каждую секунду
	 * без явного тика в компоненте.
	 */
	get slaRemainingMs() {
		const deadline = this.slaDeadlineMs;
		if (deadline === null) return null;
		// Подписка на time.strTime даёт пересчёт раз в секунду через mobx-реактивность.
		void this.context?.time?.strTime;
		return deadline - Date.now();
	}

	/** Просрочен ли SLA (для css-классов карточки). */
	get isSlaOverdue() {
		const r = this.slaRemainingMs;
		return r !== null && r < 0;
	}

	/**
	 * Рабочее время от создания до закрытия тикета в мс, за вычетом отложенности.
	 * Только для закрытых тикетов; иначе null.
	 */
	get workMsToClose() {
		if (!this.isClosed) return null;
		if (!this.createdAt || !this.closedDate) return null;
		const schedule = this.context?.schedule;
		if (!schedule) return null;
		return ticketWorkTime(schedule, this.createdAt, this.closedDate, this.holdIntervals).workMs;
	}

	/**
	 * За сколько рабочих суток (24-часовых блоков wall-clock без выходных)
	 * закрыли заявку, округлённое до десятых. Только для закрытых; иначе null.
	 */
	get workDaysToClose() {
		const ms = this.workMsToClose;
		if (ms === null) return null;
		return Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10;
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
			category: observable,
			holdIntervals: observable.ref,
			isSlaActive: computed,
			slaDeadlineMs: computed,
			slaRemainingMs: computed,
			isSlaOverdue: computed,
			workMsToClose: computed,
			workDaysToClose: computed,
			slaNonWorkDays: computed,
		});
	}
}

export default TicketItem;
