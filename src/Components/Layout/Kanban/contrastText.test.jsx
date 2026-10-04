import { contrastText } from './kanbanColor';

describe('contrastText', () => {
	test('на светлом фоне текст тёмный', () => {
		expect(contrastText('#fdd835')).toBe('#000000');	// жёлтый
		expect(contrastText('#ffffff')).toBe('#000000');
		expect(contrastText('#fb8c00')).toBe('#000000');	// оранжевый
	});

	test('на тёмном фоне текст светлый', () => {
		expect(contrastText('#8e24aa')).toBe('#ffffff');	// фиолетовый
		expect(contrastText('#1e88e5')).toBe('#ffffff');	// синий
		expect(contrastText('#000000')).toBe('#ffffff');
	});

	test('нет цвета или мусор — null, CSS возьмёт цвета темы', () => {
		expect(contrastText(null)).toBeNull();
		expect(contrastText('red')).toBeNull();
	});
});
