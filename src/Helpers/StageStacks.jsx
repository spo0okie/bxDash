/**
 * Раскладка столбцов канбана по стопкам. Чистые функции — без сторов и DOM.
 *
 * Доска — ряд СТОПОК слева направо; в стопке один или несколько столбцов сверху вниз.
 * Хранится это плоско: порядок столбцов (sort) и признак stacked — «стою под предыдущим».
 * Столбец без признака начинает новую стопку; у самого первого признак не учитывается.
 */

/**
 * Собрать стопки из плоского списка.
 * @param {Array} stages столбцы по возрастанию sort (объекты с полем stacked)
 * @returns {Array<Array>} стопки тех же объектов
 */
export function toStacks(stages) {
	const stacks = [];
	stages.forEach(stage => {
		if (stage.stacked && stacks.length) stacks[stacks.length - 1].push(stage);
		else stacks.push([stage]);
	});
	return stacks;
}

/**
 * Разложить стопки id обратно в плоский вид для бэкенда.
 * @param {Array<Array<number>>} stacks
 * @returns {{ids: number[], stacked: number[]}} порядок и id столбцов, стоящих под предыдущим
 */
export function fromStacks(stacks) {
	const ids = [];
	const stacked = [];
	stacks.forEach(stack => stack.forEach((id, index) => {
		ids.push(id);
		if (index > 0) stacked.push(id);
	}));
	return { ids, stacked };
}

/**
 * Перенести столбец относительно другого.
 *   top / bottom — в ту же стопку, над / под целевым столбцом;
 *   left / right — отдельной стопкой слева / справа от стопки целевого столбца.
 *
 * @param {Array<Array<number>>} stacks текущие стопки (id)
 * @param {number} id        переносимый столбец
 * @param {number} targetId  столбец, на который бросили
 * @param {'top'|'bottom'|'left'|'right'} edge
 * @returns {Array<Array<number>>|null} новые стопки; null — перенос ничего не меняет или невозможен
 */
export function moveInStacks(stacks, id, targetId, edge) {
	if (id === targetId) return null;
	if (!stacks.some(stack => stack.includes(id)) || !stacks.some(stack => stack.includes(targetId))) return null;

	// вынимаем столбец; опустевшую стопку убираем
	const next = stacks
		.map(stack => stack.filter(item => item !== id))
		.filter(stack => stack.length);

	const stackIndex = next.findIndex(stack => stack.includes(targetId));
	const position = next[stackIndex].indexOf(targetId);

	switch (edge) {
		case 'top': next[stackIndex].splice(position, 0, id); break;
		case 'bottom': next[stackIndex].splice(position + 1, 0, id); break;
		case 'left': next.splice(stackIndex, 0, [id]); break;
		case 'right': next.splice(stackIndex + 1, 0, [id]); break;
		default: return null;
	}

	return JSON.stringify(next) === JSON.stringify(stacks) ? null : next;
}

/**
 * К какому краю столбца относится точка — куда встанет перетаскиваемый столбец.
 * Крайние четверти по ширине — «слева» / «справа» (отдельной стопкой),
 * середина — «над» / «под» (в ту же стопку) по половинам высоты.
 *
 * @param {{left:number, top:number, width:number, height:number}} rect прямоугольник столбца-цели
 */
export function dropEdge(rect, x, y) {
	const relX = rect.width ? (x - rect.left) / rect.width : 0.5;
	if (relX < 0.25) return 'left';
	if (relX > 0.75) return 'right';
	const relY = rect.height ? (y - rect.top) / rect.height : 0.5;
	return relY < 0.5 ? 'top' : 'bottom';
}

/** Минимальная высота столбца в стопке при перетаскивании границы, px */
export const MIN_STACKED_HEIGHT = 60;

/**
 * Перетаскивание границы между двумя соседними столбцами стопки.
 * Сумма высот пары сохраняется, каждый остаётся не ниже минимума. Высоты всех развёрнутых
 * столбцов стопки переводятся в веса со средним 1 — так вес «не двигали» (1) остаётся
 * сопоставим с сохранёнными.
 *
 * @param {Array<{id:number, height:number}>} columns развёрнутые столбцы стопки с текущими высотами
 * @param {number} upperId столбец над границей
 * @param {number} lowerId столбец под границей
 * @param {number} delta   смещение границы вниз, px
 * @returns {Object} веса {id: weight}
 */
export function resizeWeights(columns, upperId, lowerId, delta) {
	const heights = new Map(columns.map(column => [column.id, column.height]));
	const pair = heights.get(upperId) + heights.get(lowerId);
	const min = Math.min(MIN_STACKED_HEIGHT, pair / 2);
	const upper = Math.max(min, Math.min(pair - min, heights.get(upperId) + delta));
	heights.set(upperId, upper);
	heights.set(lowerId, pair - upper);

	const total = columns.reduce((sum, column) => sum + heights.get(column.id), 0);
	const average = total / columns.length || 1;
	const weights = {};
	columns.forEach(column => {
		weights[column.id] = Math.round((heights.get(column.id) / average) * 1000) / 1000;
	});
	return weights;
}
