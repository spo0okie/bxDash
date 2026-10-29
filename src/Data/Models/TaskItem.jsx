import { action, computed, makeObservable, observable } from "mobx";
import DashItem from "./DashItem";
import TimeHelper from "Helpers/TimeHelper";

class TaskItem extends DashItem {
	//mark;	//оценка
	//strStatus;

	initDefaults() {
		this.type = "task"; //тип
		this.dropTimeField = "startDatePlan"; //атрибут, которым задача позиционируется в календаре
		this.updatesCount = 0; //количество обновлений в задаче
		this.accomplices = []; //соисполнители
		this.title = "Заголовок задачи\nОписание задачи";
		this.defaultTitle = "Заголовок задачи\nОписание задачи";
		this.status = 1; //новая
		this.mark = 0;
		this.strStatus = "unknown";
		this.startDatePlan = null; //плановая дата (задаёт позицию в календаре)
	}

	recalcTime() {
		this.isClosed =
			Boolean(this.closedDate) && (this.status === 5 || this.status === 7); //завершена, отменена
		this.isNow = this.status === 3 || this.status === 4; //в работе, ждет подтверж. - всегда выполняются [прямо сейчас]!

		if (this.isClosed) {
			this.t = this.closedDate;
		} else if (this.isNow) {
			this.t = this.context.time.today;
		} else {
			this.t = this.startDatePlan
				? Math.max(this.startDatePlan, this.context.time.today)
				: null;
		}

		if (this.deadline) {
			this.deadlineObj = TimeHelper.objDate(this.deadline);
			this.deadlineStr = this.deadlineObj.D + "." + this.deadlineObj.M;
			if (this.context.time.year !== this.deadlineObj.Y)
				this.deadlineStr += "." + this.deadlineObj.y;
		} else this.deadlineStr = "∞";

		if (this.closedDate) {
			this.closedDateObj = TimeHelper.objDate(this.closedDate);
			this.closedDateStr = this.closedDateObj.D + "." + this.closedDateObj.M;
			if (this.context.time.year !== this.closedDateObj.Y)
				this.closedDateStr += "." + this.closedDateObj.y;
		} else this.closedDateStr = "";
	}

	setStatus(value) {
		if (value === this.status) return;
		this.status = value;
	}

	setUpdates(value) {
		if (value === this.updatesCount) return;
		this.updatesCount = value;
	}

	/**
	 * Инициализация на данных из Birtix
	 * @param {*} item
	 * @param {*} options //сюда нужно передать {
	 * 	today = отметка "сегодня" (для задач в работе и просроченных)
	 * }
	 */
	loadData(item, recalc) {
		if (!super.loadData(item, recalc)) return false;

		this.parentUids = item.PARENT_ID ? ["task:" + Number(item.PARENT_ID)] : [];

		this.title = item["~TITLE"];

		this.user = Number(item.RESPONSIBLE_ID);
		this.accomplices = item.ACCOMPLICES
			? item.ACCOMPLICES.map((i) => Number(i))
			: [];

		this.setStatus(Number(item.REAL_STATUS));

		this.mark = 0; //Neutral
		if (item.MARK === "N") this.mark = -1; //Negative
		if (item.MARK === "P") this.mark = 1; //Positive

		switch (this.status) {
			case -1:
				this.strStatus = "Просрочена";
				break; //просрочена
			case 1:
				this.strStatus = "Новая";
				break;
			case 2:
				this.strStatus = "Ожидание";
				break; //Ожидание
			case 3:
				this.strStatus = "В работе";
				break;
			case 4:
				this.strStatus = "Ож. подтв.";
				break;
			case 5:
				this.strStatus = this.mark < 0 ? "Провалена" : "Завершена";
				break;
			case 6:
				this.strStatus = "Отложена";
				break;
			case 7:
				this.strStatus = "Отменена";
				break;
			default:
				this.strStatus = "unknown";
		}

		this.setUpdates(Number(item.UPDATES_COUNT));

		this.deadline = item.DEADLINE
			? TimeHelper.bitrixDateTimeToJs(item.DEADLINE)
			: null;

		this.startDatePlan = item.START_DATE_PLAN
			? TimeHelper.bitrixDateTimeToJs(item.START_DATE_PLAN)
			: null;

		this.createdAt = TimeHelper.bitrixDateTimeToJs(item.CREATED_DATE);

		this.closedDate = TimeHelper.bitrixDateTimeToJs(item.CLOSED_DATE);

		const defaultSorting = Math.floor(this.createdAt / 1000);
		this.sorting = item.XML_ID ? Number(item.XML_ID) : defaultSorting;
		if (isNaN(this.sorting) || this.sorting > this.maxSort) {
			this.sorting = defaultSorting;
		}

		this.setPriority(Number(item.PRIORITY));

		this.favorite = item.FAVORITE === "Y";

		this.viewUrl =
			"/company/personal/user/" +
			this.user +
			"/tasks/task/view/" +
			this.id +
			"/";

		if (recalc) this.recalcTime();
		this.setUpdating(false);
		return true;
	}

	changeStatus(newStatus) {
		if (
			newStatus === 3 &&
			!window.confirm("Начать выполнение задачи " + this.id + "?")
		)
			return false;
		if (
			newStatus === 2 &&
			!window.confirm("Остановить выполнение задачи " + this.id + "?")
		)
			return false;
		this.update({ status: newStatus }, true);
	}

	/**
	 * Остаток до дедлайна в мс (отрицательный — просрочено).
	 * Подписан на time.strTime, чтобы пересчитываться раз в секунду через mobx.
	 * null — если задача закрыта или дедлайн не задан.
	 */
	get deadlineRemainingMs() {
		if (this.isClosed) return null;
		if (!this.deadline) return null;
		// читаем и отбрасываем свойство this.context.time.strTime
		// чтобы MobX зафиксировал зависимость от него этого computed геттера
		void this.context?.time?.strTime;
		return this.deadline - Date.now();
	}

	/**
	 * Остаток до плановой даты в мс — для нейтрального отсчёта на карточке в канбане,
	 * где оси времени нет. null — если показывать нечего: задача закрыта, уже в работе,
	 * плановой даты нет или она прошла.
	 * Плановая дата известна с точностью до дня, поэтому подписываемся на минуты,
	 * а не на секунды: доска не перерисовывается каждую секунду.
	 */
	get planRemainingMs() {
		if (this.isClosed || this.isNow) return null;
		if (!this.startDatePlan) return null;
		// читаем и отбрасываем свойство this.context.time.minutes
		// чтобы MobX зафиксировал зависимость от него этого computed геттера
		void this.context?.time?.minutes;
		const remaining = this.startDatePlan - Date.now();
		return remaining > 0 ? remaining : null;
	}

	/** Просрочен ли дедлайн (для css-классов карточки). */
	get isDeadlineOverdue() {
		const r = this.deadlineRemainingMs;
		return r !== null && r < 0;
	}

	constructor(item, data, list) {
		super(item, data, list);

		makeObservable(this, {
			status: observable,
			mark: observable,
			strStatus: observable,
			updatesCount: observable,
			startDatePlan: observable,
			deadlineRemainingMs: computed,
			planRemainingMs: computed,
			isDeadlineOverdue: computed,
			setStatus: action,
			setUpdates: action,
		});

		//console.log(this);
	}
}
export default TaskItem;
