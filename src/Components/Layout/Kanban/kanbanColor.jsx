/**
 * Цвет текста, читаемый на фоне #rrggbb: тёмный на светлом, светлый на тёмном
 * (по воспринимаемой яркости, веса каналов — как в формуле YIQ).
 */
export function contrastText(hex) {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
	if (!m) return null;
	const [r, g, b] = [m[1], m[2], m[3]].map(c => parseInt(c, 16));
	return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#000000' : '#ffffff';
}
