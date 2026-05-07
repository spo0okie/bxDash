/**
 * Реестр доступных тем.
 *
 * Каждая тема — манифест (см. classic/index.js): id, человекочитаемое имя,
 * опциональные оверрайды CSS-токенов (через [data-theme="<id>"] в tokens.css)
 * и AntD-конфиг для ConfigProvider.
 *
 * Чтобы добавить новую тему: импортировать её манифест и положить в массив
 * `themes`. ThemeStore автоматически возьмёт её из реестра.
 */
import classic from 'Themes/classic';
import modern from 'Themes/modern';

export const DEFAULT_THEME_ID = 'classic';

export const themes = [
	classic,
	modern,
];

const themeIndex = new Map(themes.map(t => [t.id, t]));

/**
 * Возвращает манифест темы по id, либо undefined, если темы нет.
 */
export function getTheme(id) {
	return themeIndex.get(id);
}

/**
 * Возвращает манифест темы по id, либо манифест темы по умолчанию,
 * если запрошенной темы нет в реестре.
 */
export function getThemeOrDefault(id) {
	return themeIndex.get(id) ?? themeIndex.get(DEFAULT_THEME_ID);
}
