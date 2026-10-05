import { buildMoveParams, computeNewSort } from 'Helpers/DndHelper';

const OWNER = 5;
const DAY = 24 * 3600 * 1000;

const target = cell => ({ data: { cell } });

/** Минимальная задача: плановая дата, ответственный, текущий столбец на доске OWNER */
const makeTask = (currentStage, fields = {}) => ({
	dropTimeField: 'startDatePlan',
	startDatePlan: 10 * DAY,
	user: OWNER,
	sorting: 500,
	stageFor: jest.fn(() => currentStage),
	...fields,
});

const kanbanCell = (stageId, user = OWNER) => ({
	id: 'kanban/' + stageId, kanban: true, user, stage: { id: stageId }, t: null, dropT: null,
});

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('buildMoveParams: канбан', () => {
	test('перенос в другой столбец меняет только столбец и порядок', () => {
		const task = makeTask(1);
		const params = buildMoveParams(task, target(kanbanCell(1)), target(kanbanCell(2)), 480);

		expect(params).toEqual({ sorting: 480, stage: 2, stageUser: OWNER });
		expect(task.stageFor).toHaveBeenCalledWith(OWNER);
	});

	test('дата и ответственный в параметры не попадают', () => {
		// у столбца t === null, как у долгого ящика: без ветки kanban это сбросило бы плановую дату
		const params = buildMoveParams(makeTask(1), target(kanbanCell(1)), target(kanbanCell(2)), 480);

		expect(params).not.toHaveProperty('startDatePlan');
		expect(params).not.toHaveProperty('deadline');
		expect(params).not.toHaveProperty('user');
		expect(params).not.toHaveProperty('priority');
	});

	test('перестановка внутри столбца — только порядок', () => {
		const params = buildMoveParams(makeTask(2), target(kanbanCell(2)), target(kanbanCell(2)), 620);
		expect(params).toEqual({ sorting: 620 });
	});

	test('заявка (недвижимый элемент): меняется только столбец, порядок не сохраняется', () => {
		const ticket = makeTask(1, { isUnmovable: true });
		expect(buildMoveParams(ticket, target(kanbanCell(1)), target(kanbanCell(2)), 480))
			.toEqual({ stage: 2, stageUser: OWNER });
	});

	test('заявку бросили в её же столбец — менять нечего', () => {
		const ticket = makeTask(2, { isUnmovable: true });
		expect(buildMoveParams(ticket, target(kanbanCell(2)), target(kanbanCell(2)), 480)).toEqual({});
	});

	test('задача соисполнителя не переназначается на владельца доски', () => {
		const task = makeTask(1, { user: 7 });
		const params = buildMoveParams(task, target(kanbanCell(1)), target(kanbanCell(3)), 480);

		expect(params).toEqual({ sorting: 480, stage: 3, stageUser: OWNER });
	});
});

describe('buildMoveParams: календарь (поведение не изменилось)', () => {
	const calendarCell = (t, user, extra = {}) => ({ id: 'cell' + t + '/' + user, t, dropT: t + 18 * 3600 * 1000, user, ...extra });

	test('перенос на другой день и другому пользователю', () => {
		const task = makeTask(1);
		const params = buildMoveParams(task, target(calendarCell(10 * DAY, OWNER)), target(calendarCell(12 * DAY, 7)), 300);

		expect(params).toEqual({ startDatePlan: 12 * DAY + 18 * 3600 * 1000, user: 7, sorting: 300 });
		expect(task.stageFor).not.toHaveBeenCalled();
	});

	test('перестановка в той же ячейке сохраняет дату и пользователя', () => {
		const cell = calendarCell(10 * DAY, OWNER);
		expect(buildMoveParams(makeTask(1), target(cell), target(cell), 300))
			.toEqual({ startDatePlan: 10 * DAY, user: OWNER, sorting: 300 });
	});

	test('ячейка долгого ящика с приоритетом передаёт приоритет', () => {
		const source = calendarCell(10 * DAY, OWNER);
		const bucket = { id: 'cellB/5/2', t: 99 * DAY, dropT: null, user: OWNER, priority: 2 };
		expect(buildMoveParams(makeTask(1), target(source), target(bucket), 300))
			.toEqual({ startDatePlan: null, user: OWNER, sorting: 300, priority: 2 });
	});
});

describe('computeNewSort: бросок в пустое место списка', () => {
	const task = { sorting: 500 };

	test('в конец — на 100 ниже последней обычной карточки', () => {
		expect(computeNewSort(task, [{ sorting: 900 }, { sorting: 700 }], null)).toBe(600);
	});

	test('заявки в списке не учитываются: у них нет своего порядка', () => {
		const ticket = { sorting: 0, isUnmovable: true };
		expect(computeNewSort(task, [ticket, { sorting: 900 }], null)).toBe(800);
		// в столбце только заявки — порядок задачи не меняется
		expect(computeNewSort(task, [ticket], null)).toBe(500);
	});

	test('пустой список — порядок не меняется', () => {
		expect(computeNewSort(task, [], null)).toBe(500);
	});
});
