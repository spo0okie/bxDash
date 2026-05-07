import { makeObservable, observable, action, computed, reaction } from 'mobx';
import { themes, getTheme, DEFAULT_THEME_ID } from 'Themes/registry';

const COOKIE_NAME = 'theme';

/**
 * Сторадж активной темы оформления.
 *
 * Тема глобальная: один cookie `theme` для всего приложения. Применение —
 * установка `<html data-theme="<id>">` (CSS-токены каскадом перекрашивают
 * UI) + computed `antdTheme`, который читает ConfigProvider в App.jsx.
 */
class ThemeStore {
	main;

	/** @type {string} ID активной темы. */
	currentThemeId = DEFAULT_THEME_ID;

	constructor(main) {
		this.main = main;

		makeObservable(this, {
			currentThemeId: observable,
			currentTheme: computed,
			availableThemes: computed,
			antdTheme: computed,
			setTheme: action,
		});

		const saved = this.main.loadOption(COOKIE_NAME);
		if (saved && getTheme(saved)) this.currentThemeId = saved;

		reaction(
			() => this.currentThemeId,
			() => this._applyToDom(),
			{ fireImmediately: true },
		);
	}

	get currentTheme() {
		return getTheme(this.currentThemeId) ?? getTheme(DEFAULT_THEME_ID);
	}

	get availableThemes() {
		return themes;
	}

	/**
	 * Подмножество для AntD ConfigProvider. Если тема не задаёт antd —
	 * возвращаем пустой объект (AntD использует свои дефолты).
	 */
	get antdTheme() {
		return this.currentTheme?.antd ?? {};
	}

	setTheme(id) {
		if (!getTheme(id)) return;
		this.currentThemeId = id;
		this.main.saveOption(COOKIE_NAME, id);
	}

	_applyToDom() {
		if (typeof document === 'undefined') return;
		document.documentElement.setAttribute('data-theme', this.currentThemeId);
	}
}

export default ThemeStore;
