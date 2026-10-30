import { toStacks, fromStacks, moveInStacks, dropEdge, resizeWeights, MIN_STACKED_HEIGHT } from 'Helpers/StageStacks';

const st = (id, stacked = false) => ({ id, stacked });
const ids = stacks => stacks.map(stack => stack.map(s => s.id));

test('размеры в смешанной стопке сохраняют строковые id системных колонок', () => {
	expect(resizeWeights([{ id: 1, height: 100 }, { id: 'control', height: 100 }], 1, 'control', 20))
		.toEqual({ 1: 1.2, control: 0.8 });
});

describe('toStacks / fromStacks', () => {
	test('столбец с признаком встаёт под предыдущий', () => {
		expect(ids(toStacks([st(1), st(2, true), st(3), st(4, true), st(5, true)]))).toEqual([[1, 2], [3, 4, 5]]);
	});

	test('у первого столбца признак не учитывается', () => {
		expect(ids(toStacks([st(1, true), st(2)]))).toEqual([[1], [2]]);
		expect(toStacks([])).toEqual([]);
	});

	test('fromStacks — обратное преобразование', () => {
		expect(fromStacks([[1, 2], [3, 4, 5]])).toEqual({ ids: [1, 2, 3, 4, 5], stacked: [2, 4, 5] });
		expect(fromStacks([[1], [2]])).toEqual({ ids: [1, 2], stacked: [] });
	});
});

describe('moveInStacks', () => {
	const base = [[1], [2], [3]];

	test('сверху и снизу — в стопку цели', () => {
		expect(moveInStacks(base, 3, 1, 'bottom')).toEqual([[1, 3], [2]]);
		expect(moveInStacks(base, 3, 1, 'top')).toEqual([[3, 1], [2]]);
	});

	test('слева и справа — отдельной стопкой рядом со стопкой цели', () => {
		expect(moveInStacks(base, 3, 1, 'left')).toEqual([[3], [1], [2]]);
		expect(moveInStacks(base, 1, 3, 'right')).toEqual([[2], [3], [1]]);
		// цель в середине стопки — новая стопка встаёт рядом со всей стопкой
		expect(moveInStacks([[1, 2], [3]], 3, 2, 'left')).toEqual([[3], [1, 2]]);
	});

	test('вынос из стопки и перестановка внутри неё', () => {
		expect(moveInStacks([[1, 2, 3]], 2, 1, 'right')).toEqual([[1, 3], [2]]);
		expect(moveInStacks([[1, 2, 3]], 3, 1, 'top')).toEqual([[3, 1, 2]]);
		expect(moveInStacks([[1, 2, 3]], 1, 3, 'bottom')).toEqual([[2, 3, 1]]);
	});

	test('перенос, который ничего не меняет, возвращает null', () => {
		expect(moveInStacks(base, 2, 1, 'right')).toBeNull();
		expect(moveInStacks(base, 2, 3, 'left')).toBeNull();
		expect(moveInStacks([[1, 2]], 2, 1, 'bottom')).toBeNull();
		expect(moveInStacks(base, 2, 2, 'top')).toBeNull();
	});

	test('неизвестные столбец, цель или край — null; исходные стопки не меняются', () => {
		const original = [[1, 2], [3]];
		expect(moveInStacks(original, 9, 1, 'top')).toBeNull();
		expect(moveInStacks(original, 1, 9, 'top')).toBeNull();
		expect(moveInStacks(original, 3, 1, 'middle')).toBeNull();
		moveInStacks(original, 3, 1, 'top');
		expect(original).toEqual([[1, 2], [3]]);
	});
});

describe('dropEdge', () => {
	const rect = { left: 100, top: 50, width: 200, height: 400 };

	test('крайние четверти по ширине — слева и справа', () => {
		expect(dropEdge(rect, 110, 250)).toBe('left');
		expect(dropEdge(rect, 290, 60)).toBe('right');
	});

	test('середина — сверху или снизу по половине высоты', () => {
		expect(dropEdge(rect, 200, 100)).toBe('top');
		expect(dropEdge(rect, 200, 400)).toBe('bottom');
	});
});

describe('resizeWeights', () => {
	const columns = [{ id: 1, height: 300 }, { id: 2, height: 300 }, { id: 3, height: 300 }];

	test('граница сдвигает высоты пары, сумма сохраняется, остальные не меняются', () => {
		const w = resizeWeights(columns, 1, 2, 150);
		expect(w).toEqual({ 1: 1.5, 2: 0.5, 3: 1 });
	});

	test('столбец не становится ниже минимума', () => {
		const w = resizeWeights(columns, 1, 2, 10000);
		expect(w[2]).toBeCloseTo(MIN_STACKED_HEIGHT / 300, 3);
		expect(w[1] + w[2]).toBeCloseTo(2, 2);
		const up = resizeWeights(columns, 1, 2, -10000);
		expect(up[1]).toBeCloseTo(MIN_STACKED_HEIGHT / 300, 3);
	});

	test('без сдвига равные высоты дают вес 1 — как у «границу не двигали»', () => {
		expect(resizeWeights(columns, 2, 3, 0)).toEqual({ 1: 1, 2: 1, 3: 1 });
	});
});
