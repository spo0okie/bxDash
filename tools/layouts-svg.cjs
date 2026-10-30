/**
 * Генератор схем раскладок для docs/layouts.md.
 *
 * Рисует вложенные прямоугольники строго по вложенности DOM: блок-потомок лежит
 * внутри блока-родителя, соседи идут в порядке DOM — сверху вниз (dir: 'col')
 * или слева направо (dir: 'row').
 *
 * Запуск: node tools/layouts-svg.cjs  → docs/layouts/*.svg
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'layouts');

// === Метрики ===
const CW = 6.7;   // ширина символа моноширинного шрифта 11px (с запасом)
const LH = 14;    // высота строки
const P = 7;      // внутренний отступ блока
const G = 6;      // зазор между соседями

// === Палитра ===
const DEPTH_FILL = ['#f5f6fa', '#e9ecf5', '#f5f6fa', '#e9ecf5'];
const CARD_FILL = {
	task: '#dbeafe',
	job: '#dcfce7',
	ticket: '#fee2e2',
	plan: '#fef3c7',
	memo: '#f3e8ff',
};

// === Конструкторы узлов ===
/** Блок-контейнер, дети сверху вниз */
const col = (t, ...ch) => node(t, 'col', ch);
/** Блок-контейнер, дети слева направо */
const row = (t, ...ch) => node(t, 'row', ch);
/** Лист */
const leaf = (t) => node(t, 'col', []);
/** Свёрнутый повтор соседей ("… ещё 6 таких же") */
const ghost = (t) => ({ ...leaf(t), ghost: true });
/** Карточка элемента */
const card = (type) => ({ ...leaf(type + 'Item'), card: type });
/** Условный блок (рендерится не всегда) — пунктирная рамка */
const opt = (n) => ({ ...n, opt: true });
/** Блок забирает свободное место по главной оси родителя */
const grow = (n, k = 1) => ({ ...n, grow: k });

function node(t, dir, ch) {
	// первая строка — заголовок (селектор), остальные — пояснения
	const lines = t.split('\n');
	return { title: lines[0], notes: lines.slice(1), dir, ch };
}

// === Раскладка ===
function measure(n) {
	const lines = [n.title, ...n.notes];
	const textW = Math.max(...lines.map(l => l.length)) * CW;
	n.headH = lines.length * LH + 5;
	n.ch.forEach(measure);
	if (!n.ch.length) {
		n.w = textW + 2 * P;
		n.h = n.headH + 3;
		return;
	}
	const gaps = G * (n.ch.length - 1);
	const iw = n.dir === 'col'
		? Math.max(...n.ch.map(c => c.w))
		: n.ch.reduce((s, c) => s + c.w, 0) + gaps;
	const ih = n.dir === 'col'
		? n.ch.reduce((s, c) => s + c.h, 0) + gaps
		: Math.max(...n.ch.map(c => c.h));
	n.w = Math.max(textW, iw) + 2 * P;
	n.h = n.headH + ih + P;
}

function place(n, x, y, w, h, depth = 0) {
	Object.assign(n, { x, y, w, h, depth });
	if (!n.ch.length) return;
	const ax = x + P, ay = y + n.headH, aw = w - 2 * P, ah = h - n.headH - P;
	const main = n.dir === 'col' ? 'h' : 'w';
	const used = n.ch.reduce((s, c) => s + c[main], 0) + G * (n.ch.length - 1);
	const extra = Math.max(0, (n.dir === 'col' ? ah : aw) - used);
	// свободное место делим между grow-детьми; в строке без grow — поровну между всеми
	const growers = n.ch.filter(c => c.grow);
	const total = growers.reduce((s, c) => s + c.grow, 0);
	const share = c => {
		if (total) return c.grow ? extra * c.grow / total : 0;
		return n.dir === 'row' ? extra / n.ch.length : 0;
	};
	let pos = n.dir === 'col' ? ay : ax;
	for (const c of n.ch) {
		const size = c[main] + share(c);
		if (n.dir === 'col') place(c, ax, pos, aw, size, depth + 1);
		else place(c, pos, ay, size, ah, depth + 1);
		pos += size + G;
	}
}

// === Отрисовка ===
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = v => Math.round(v * 10) / 10;

function draw(n, out) {
	const fill = n.ghost ? '#ffffff' : n.card ? CARD_FILL[n.card] : DEPTH_FILL[n.depth % DEPTH_FILL.length];
	const dash = (n.opt || n.ghost) ? ' stroke-dasharray="5 3"' : '';
	const stroke = n.ghost ? '#b6bac8' : n.card ? '#7d8799' : '#6b7285';
	out.push(`<rect x="${r1(n.x)}" y="${r1(n.y)}" width="${r1(n.w)}" height="${r1(n.h)}" rx="3" fill="${fill}" stroke="${stroke}"${dash}/>`);
	const tx = r1(n.x + P);
	let ty = n.y + LH + 1;
	const titleCls = n.ghost ? 'g' : 't';
	out.push(`<text x="${tx}" y="${r1(ty)}" class="${titleCls}">${esc(n.title)}</text>`);
	for (const l of n.notes) {
		ty += LH;
		out.push(`<text x="${tx}" y="${r1(ty)}" class="n">${esc(l)}</text>`);
	}
	n.ch.forEach(c => draw(c, out));
}

function render(name, root) {
	measure(root);
	place(root, 8, 8, root.w, root.h);
	const W = Math.ceil(root.w + 16), H = Math.ceil(root.h + 16);
	const out = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
		`<style>text{font:11px Consolas,Menlo,'DejaVu Sans Mono',monospace;fill:#1c2030}.t{font-weight:bold}.n{fill:#5b6275}.g{fill:#8a90a2;font-style:italic}</style>`,
		`<rect width="${W}" height="${H}" fill="#ffffff"/>`,
	];
	draw(root, out);
	out.push('</svg>');
	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, name + '.svg'), out.join('\n') + '\n');
	console.log(name + '.svg', W + 'x' + H);
}

// === Общие фрагменты ===

/** Содержимое ячейки: td.userCell › div.userCellContent */
const userCell = (who, closed = ['plan', 'job'], opened = ['task', 'job', 'ticket']) =>
	col(`td.userCell › div.userCellContent\n${who}`,
		leaf('div.userCellHeader\nсчётчики элементов'),
		col('ul\nCardsBlock: закрытые + планы', ...closed.map(card)),
		leaf('span.CreateItemButton'),
		grow(opt(col('ul.droppableBlock\nCardsBlock: открытые, DnD\nтолько если period.isOpen', ...opened.map(card)))),
	);

/** Ячейка-заглушка "то же самое" */
const userCellStub = who => grow(ghost(`td.userCell\n${who}\n(то же)`));

/** Период-строка общей доски: заголовок слева, пользователи колонками */
const periodRow = (title, detailed) =>
	col(`div.Period.row.periodN\n${title}`,
		row('div.periodContent',
			leaf('div.PeriodTitle\nh3 повёрнут\nвертикально'),
			grow(row('div.PeriodData › table.UserCells › tbody › tr',
				...(detailed
					? [userCell('пользователь 1'), userCell('пользователь 2', ['job'], ['task']), userCellStub('пользователь N')]
					: [userCellStub('пользователь 1'), userCellStub('пользователь 2'), userCellStub('пользователь N')]),
			)),
		),
	);

/** Период-колонка персональной доски: заголовок сверху */
const periodColumn = (title, cell) =>
	col(`div.Period.column.periodN\n${title}`,
		grow(col('div.periodContent',
			leaf('div.PeriodTitle'),
			grow(col('div.PeriodData › table.UserCells › tbody › tr', grow(cell))),
		)),
	);

const periodColumnStub = title => grow(ghost(`div.Period\n.column\n${title}\n(то же)`));

const selectedCell = (closed, opened) => userCell('выбранный пользователь', closed, opened);

/** Корзина в правой панели */
const rightPaneBucket = (split) => split
	? col('div.rightPane.x3\n450px',
		grow(row('BucketIntervals (фрагмент, без своего DOM-узла)',
			...['priority=2\nВысокий приоритет', 'priority=1\nСредний приоритет', 'priority=0\nОтложено'].map(p =>
				col(`div.Interval.columnBucket\n${p.split('\n')[0]}`,
					grow(periodColumn(p.split('\n')[1], selectedCell([], ['task', 'job'])))),
			),
		)))
	: col('div.rightPane\n200px',
		grow(col('div.Interval.columnBucket',
			grow(periodColumn('Долгий ящик', selectedCell([], ['task', 'job', 'ticket']))))));

// === Схемы ===

// 1. Общий каркас
render('frame',
	col('body',
		col('div#root',
			opt(leaf('ControlPanel — панель авторизации / отладки  (при проблемах auth/WS или layout.debugVisible)')),
			opt(leaf('ModalWindow — antd Modal.bxModal с iframe  (layout.modalVisible)')),
			opt(leaf('CreateTicketModal  (layout.ticketModalVisible)')),
			opt(leaf('div.IncomingCallsStack › IncomingCallCard × N  (есть активные звонки)')),
			col('div.AppHeader\nposition: fixed, поверх доски',
				row('div.layout',
					opt(leaf('div.memo\n«Заметки»\nесли memosVisible')),
					grow(col('div.dashBoard',
						row('div.AppUserList',
							leaf('div.PeriodTitle\nпустой отступ'),
							grow(row('div.PeriodData.Row › table.UserCells › tbody › tr',
								grow(leaf('td › UserItem\nпользователь 1')),
								grow(leaf('td › UserItem\nпользователь 2')),
								grow(leaf('td › UserItem\nпользователь N')),
							)),
							leaf('div.dummyScrollBar'),
						),
					)),
				),
			),
			opt(leaf('div.task-search-modal — TaskSearch  (Ctrl+K)')),
			leaf('HomeButton — плавающая кнопка «домой»'),
			leaf('MenuButton .memoButton 📝   → layout.memosVisible'),
			leaf('MenuButton .optionsButton ⚙️ → layout.debugVisible'),
			leaf('MenuButton .calendarButton 📅/📆 → layout.expand'),
			row('div.layout\nflex row',
				opt(row('div.App-Sidebar\nесли memosVisible',
					grow(col('div.App-Sidebar-content',
						col('div.userCellContent.memoCell',
							col('ul\nзакрытые', card('memo')),
							leaf('span.CreateItemButton\n«добавить»'),
							grow(col('ul.droppableBlock\nоткрытые, DnD', card('memo'), card('memo'))),
						),
					)),
					leaf('div.App-\nSidebar-\nresizer'),
				)),
				grow(col('div.dashBoard',
					grow(col('div#calendarGrid.Calendar\nScrollSection — прокручиваемая область',
						grow(ghost('Interval × N  →  содержимое зависит от раскладки, см. схемы A–D')),
						opt(ghost('BucketIntervals (корзина)  →  здесь только на общей доске')),
					)),
				), 3),
				opt(col('div.rightPane\nтолько на персональной доске',
					grow(ghost('BucketIntervals\n(корзина)')),
				)),
			),
		),
	),
);

// 2. A — общая доска, по дням
render('a-all-days',
	col('div#calendarGrid.Calendar\nпрокрутка по вертикали',
		col('div.Interval.row\nтекущая неделя',
			periodRow('Пн', true),
			periodRow('Вт', false),
			ghost('div.Period.row × 5 — Ср … Вс (то же)'),
		),
		ghost('div.Interval.row × N — следующие недели (то же)'),
		col('div.Interval.row\nкорзина, id = weekMax + 1',
			periodRow('Долгий ящик', false),
		),
	),
);

// 3. B — общая доска, по неделям
render('b-all-weeks',
	col('div#calendarGrid.Calendar\nпрокрутка по вертикали',
		col('div.Interval.row\nтекущая неделя',
			periodRow('Эта неделя — единственный Period в интервале', true),
		),
		col('div.Interval.row\nследующая неделя',
			periodRow('След. неделя', false),
		),
		ghost('div.Interval.row × N — остальные недели (то же)'),
		col('div.Interval.row\nкорзина, id = weekMax + 1',
			periodRow('Долгий ящик', false),
		),
	),
);

// 4. C — персональная доска, по дням
render('c-personal-days',
	row('div.layout',
		grow(col('div.dashBoard',
			col('div#calendarGrid.Calendar\nпрокрутка по вертикали',
				row('div.Interval.personalRow\nтекущая неделя — CSS grid, 7 равных колонок',
					periodColumn('Пн', selectedCell(['plan', 'job'], ['task', 'ticket'])),
					periodColumnStub('Вт'),
					periodColumnStub('Ср'),
					periodColumnStub('Чт'),
					periodColumnStub('Пт'),
					periodColumnStub('Сб'),
					periodColumnStub('Вс'),
				),
				ghost('div.Interval.personalRow × N — следующие недели (то же)'),
			),
		)),
		rightPaneBucket(false),
	),
);

// 5. D — персональная доска, по неделям
render('d-personal-weeks',
	row('div.layout',
		grow(col('div.dashBoard',
			grow(row('div#calendarGrid.Calendar.ColumnScroller\nпрокрутка по горизонтали',
				col('div.Interval.column\nтекущая неделя, 200px',
					grow(periodColumn('Эта неделя', selectedCell(['plan', 'job'], ['task', 'job', 'ticket'])))),
				col('div.Interval.column\nследующая неделя, 200px',
					grow(periodColumn('След. неделя', selectedCell([], ['task', 'job'])))),
				grow(ghost('div.Interval.column × N\nостальные недели\n(то же)')),
			)),
		)),
		rightPaneBucket(false),
	),
);

// 6. Ячейка пользователя
render('cell',
	col('td.userCell\n+ класс .draggedOver, пока над ячейкой тащат карточку',
		col('div.userCellContent\nflex column; фон — градиент отсутствий пользователя',
			row('div.userCellHeader',
				leaf('span\nзакрыто\nтикетов'), leaf('span\nвыполнено\nработ'), leaf('span\nзакрыто\nзадач'),
				leaf('span\nоткрыто\nтикетов'), leaf('span\nзаплан.\nработ'), leaf('span\nоткрыто\nзадач'),
			),
			col('ul\nCardsBlock dnd=false — закрытые элементы и планы',
				card('plan'), card('job'), card('task'), card('ticket'),
			),
			row('span.CreateItemButton\nнабор кнопок зависит от period.isOpen / isClosed / isToday',
				opt(leaf('closedJob\nпериод закрыт')), opt(leaf('job\nпериод открыт')),
				opt(leaf('ticket\nтолько сегодня')), opt(leaf('task\nпериод открыт')), opt(leaf('plan\nесли wDays ∋ 6')),
			),
			opt(col('ul.droppableBlock\nCardsBlock dnd=true — открытые элементы, drop-target; только если period.isOpen',
				card('task'), card('job'), card('ticket'),
			)),
		),
	),
);

// 7. Корзина, split-режим
render('bucket-split-personal',
	row('div.layout',
		grow(ghost('div.dashBoard\nкалендарь — раскладка C или D')),
		rightPaneBucket(true),
	),
);

render('bucket-split-all',
	col('div#calendarGrid.Calendar',
		ghost('div.Interval.row × N — недели (раскладка A или B)'),
		col('div.Interval.row\nкорзина, priority=2', periodRow('Высокий приоритет', false)),
		col('div.Interval.row\nкорзина, priority=1', periodRow('Средний приоритет', false)),
		col('div.Interval.row\nкорзина, priority=0', periodRow('Отложено', false)),
	),
);

// 8. E — персональная доска, канбан
/** Столбец канбана: заголовок + тело с теми же CardsBlock, что в календаре */
const kanbanColumn = (title, cards) =>
	col(`div.kanbanColumn\n${title}`,
		row('div.kanbanColumnTitle',
			leaf('button\n.kanbanMenu'), grow(leaf('h3\nназвание')), leaf('span\n.kanbanCount'), leaf('button\n.kanbanCollapse')),
		grow(col('div.kanbanColumnBody.userCellContent',
			leaf('span.CreateItemButton\nработа / задача без даты'),
			grow(col('ul.droppableBlock\nCardsBlock dnd=true', ...cards.map(card))),
		)),
	);

render('e-personal-kanban',
	row('div.layout',
		grow(row('div#kanbanBoard.kanbanBoard\nпрокрутка по горизонтали; вместо div.dashBoard и div.rightPane',
			col('div.kanbanStack\nстопка из одного столбца, 200px',
				grow(kanbanColumn('столбец по умолчанию «Входящие»', ['task', 'job', 'ticket']))),
			col('div.kanbanStack.stacked\nстолбцы друг под другом',
				grow(kanbanColumn('верхний столбец', ['task'])),
				leaf('div.kanbanResizer — подвижная граница'),
				grow(kanbanColumn('нижний столбец', ['task', 'job'])),
				leaf('div.kanbanColumn.collapsed.row — свёрнутый в стопке: одна строка')),
			ghost('div.kanbanStack × N\nостальные стопки\n(то же)'),
			leaf('div.kanbanStack\n.narrow ›\ndiv.kanbanColumn\n.collapsed\nодиночный\nсвёрнутый:\nвертикально'),
			opt(col('div.kanbanColumn.closed\n«Завершенные», можно удалить\nпо умолчанию свёрнут',
				leaf('div.kanbanColumnTitle\nперенос / цвет / свернуть / удалить'),
				grow(col('div.kanbanColumnBody › ul\nCardsBlock dnd=false', card('task'), card('job'))),
			)),
			opt(col('div.kanbanColumn\n«Контроль» / «От меня»\nсистемные списки по ролям',
				leaf('div.kanbanColumnTitle\nперенос / цвет / свернуть / удалить\nможно объединять с обычными в стопку'),
				grow(col('div.kanbanColumnBody › ul\nCardsBlock dnd=false\ncell.readOnly=true', card('task'))),
			)),
			leaf('button\n.kanbanAddColumn\nменю: настраиваемая /\nзавершенные / контроль / от меня'),
		)),
	),
);
