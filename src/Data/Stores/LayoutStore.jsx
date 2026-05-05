/*
Тут мы будем хранить наши настройки раскладки
 */
import 'reflect-metadata';
import {observable, makeObservable, action, computed, observe} from 'mobx';
import { scroller } from 'react-scroll';

/**
 * Дефолты для всех персистируемых настроек раскладки.
 * Источник правды — этот объект; авто-сохранение в куки делается через observe(prefs).
 */
const PREF_DEFAULTS = {
	expand: true,                  //разбивать недели по дням
	accomplicesVisible: false,     //показывать задачи у соисполнителей
	plansVisible: true,            //показывать планы
	jobsVisible: true,             //показывать работы
	tasksVisible: true,            //показывать задачи
	ticketsVisible: true,          //показывать заявки
	memosVisible: false,           //показывать напоминания (sidebar)
	keepPlanning: false,           //не скрывать относящееся к планам
	keepFavorites: false,          //не скрывать относящееся к избранному
	useSplitBucket: false,         //разделить долгий ящик на три приоритета
	sidebarWidth: 300,             //ширина sidebar (валидируется clamp'ом в setter'е)
};

const SIDEBAR_MIN = 150;
const SIDEBAR_MAX = 600;

class LayoutStore {
	main;
	time;
	users;

	/** Все персистируемые настройки в одной observable.map. Авто-сохранение в куки через observe.
	 *  Инициализируется в конструкторе через observable.map(initial), а не через .set(),
	 *  иначе MobX strict-mode бросает на запись observable вне action. */
	prefs;

	scrollbarWidth = 0;

	// === Не-персистируемое UI-состояние ===
	modalVisible = false;          //модальное окно для iFrame
	ticketModalVisible = false;    //модальное окно для новой заявки
	debugVisible = false;
	modal;

	// .struct гарантирует, что observer не сработает, пока dimensions не изменятся deep-equal
	windowDimensions = {
		width: window.innerWidth,
		height: window.innerHeight
	};

	getScrollbarWidth = () => {
		// Creating invisible container
		const outer = document.createElement('div');
		outer.style.visibility = 'hidden';
		outer.style.overflow = 'scroll'; // forcing scrollbar to appear
		outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
		document.body.appendChild(outer);

		// Creating inner element and placing it in the container
		const inner = document.createElement('div');
		outer.appendChild(inner);

		// Calculating difference between container's full width and the child width
		const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

		// Removing temporary elements from the DOM
		outer.parentNode.removeChild(outer);

		return scrollbarWidth;
	};

	scrollTo(item, duration = 700) {
		scroller.scrollTo(item, {
			duration: duration,
			delay: 0,
			smooth: 'easeInOutQuint',
			containerId: 'calendarGrid',
			offset: -50, // Scrolls to element + 50 pixels down the page
			horizontal: !this.expand && this.users.selected !== null,
		});
	}

	scrollToday(duration = 1200) {
		const today = this.expand ? this.time.today : this.time.monday0;
		this.scrollTo('period' + today, duration);
	}

	scrollToLastWeek(duration = 1200) {
		const lastWeek = this.time.weekStart(this.time.weekMax);
		this.scrollTo('period' + lastWeek, duration);
	}

	// === Управление модалками (не персистируется) ===

	setModalVisible(visible) {
		this.modalVisible = visible;
	}

	setTicketModalVisible(visible) {
		this.ticketModalVisible = visible;
	}

	setModal(modal, visible = null) {
		this.modal = modal;
		if (modal === null) modal = {
			title: null,
			content: null,
			onClose: () => {},
		}
		if (visible === null) visible = Boolean(modal.content);
		this.setModalVisible(visible);
	}

	setDebugVisible(value) {
		this.debugVisible = value;
	}

	setWindowDimensions(dims) {
		this.windowDimensions = dims;
	}

	// === Универсальный setter для персистируемых настроек ===

	/** Универсальный сеттер. Запись в prefs триггерит observe → сохранение в куки. */
	setPref(key, value) {
		this.prefs.set(key, value);
	}

	// === Обёртки совместимости для прежнего API setX(value) ===
	// MenuIButton делает layout['set'+CapitalizedProperty](value), InvAuthForm зовёт явно по имени.
	// Поэтому имена сохраняем 1:1.

	setExpand(v)             { this.setPref('expand', v); }
	setAccomplicesVisible(v) { this.setPref('accomplicesVisible', v); }
	setJobsVisible(v)        { this.setPref('jobsVisible', v); }
	setPlansVisible(v)       { this.setPref('plansVisible', v); }
	setTasksVisible(v)       { this.setPref('tasksVisible', v); }
	setTicketsVisible(v)     { this.setPref('ticketsVisible', v); }
	setMemosVisible(v)       { this.setPref('memosVisible', v); }
	setKeepPlanning(v)       { this.setPref('keepPlanning', v); }
	setKeepFavorites(v)      { this.setPref('keepFavorites', v); }
	setUseSplitBucket(v)     { this.setPref('useSplitBucket', v); }

	/** sidebarWidth имеет ОТДЕЛЬНЫЙ setter с clamp-валидацией. */
	setSidebarWidth(value) {
		value = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, value));
		this.setPref('sidebarWidth', value);
	}

	// === Геттеры совместимости ===
	// MenuIButton читает layout[property] напрямую — нужны именованные геттеры.

	get expand()             { return this.prefs.get('expand'); }
	get accomplicesVisible() { return this.prefs.get('accomplicesVisible'); }
	get jobsVisible()        { return this.prefs.get('jobsVisible'); }
	get plansVisible()       { return this.prefs.get('plansVisible'); }
	get tasksVisible()       { return this.prefs.get('tasksVisible'); }
	get ticketsVisible()     { return this.prefs.get('ticketsVisible'); }
	get memosVisible()       { return this.prefs.get('memosVisible'); }
	get keepPlanning()       { return this.prefs.get('keepPlanning'); }
	get keepFavorites()      { return this.prefs.get('keepFavorites'); }
	get useSplitBucket()     { return this.prefs.get('useSplitBucket'); }
	get sidebarWidth()       { return this.prefs.get('sidebarWidth'); }

	loadOption(name)        { return this.main.loadOption('layout.' + name); }
	saveOption(name, value) { return this.main.saveOption('layout.' + name, value); }

	constructor(main, time, users) {
		this.main = main;
		this.time = time;
		this.users = users;
		this.scrollbarWidth = this.getScrollbarWidth();

		// Инициализация persistent-настроек: cookie → fallback на дефолт.
		// Создаём observable.map с initial entries — НЕ .set() в цикле,
		// иначе MobX strict-mode жалуется на изменение observable вне action.
		const initialPrefs = {};
		Object.entries(PREF_DEFAULTS).forEach(([key, dflt]) => {
			const stored = this.loadOption(key);
			initialPrefs[key] = stored ?? dflt;
		});
		this.prefs = observable.map(initialPrefs);

		this.setModal(null);

		makeObservable(this, {
			prefs: observable,
			modalVisible: observable,
			ticketModalVisible: observable,
			debugVisible: observable,
			windowDimensions: observable.struct,
			setModalVisible: action,
			setTicketModalVisible: action,
			setDebugVisible: action,
			setWindowDimensions: action,
			setPref: action,
			// Геттеры-обёртки над prefs регистрируются как computed —
			// иначе observe(layout, 'expand', ...) и т.п. throw'ит "no observable property".
			expand: computed,
			accomplicesVisible: computed,
			jobsVisible: computed,
			plansVisible: computed,
			tasksVisible: computed,
			ticketsVisible: computed,
			memosVisible: computed,
			keepPlanning: computed,
			keepFavorites: computed,
			useSplitBucket: computed,
			sidebarWidth: computed,
		});

		// Авто-сохранение любых изменений prefs в куки.
		// observe срабатывает на add/update/delete; для нашего use-case ключи только меняют значение.
		observe(this.prefs, change => {
			if (change.type === 'add' || change.type === 'update') {
				this.saveOption(change.name, change.newValue);
			}
		});

		window.onresize = () => {
			console.log('height => ' + window.innerHeight);
			this.setWindowDimensions({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		}
	}
}

export default LayoutStore;
