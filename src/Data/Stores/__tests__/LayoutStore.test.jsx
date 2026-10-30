import LayoutStore from '../LayoutStore';

test('системные колонки сохраняются по владельцу доски, без дублей и с обратимым удалением', () => {
	const saved = new Map();
	const main = {
		loadOption: key => saved.get(key),
		saveOption: (key, value) => saved.set(key, value),
	};
	const layout = new LayoutStore(main, {}, { selected: 5 });
	const keys = (store, owner) => store.systemColumnsOf(owner).map(column => column.key);
	expect(keys(layout, 5)).toEqual(['closed']);
	layout.setKanbanSystemColumn(5, 'closed', false);
	expect(keys(layout, 5)).toEqual([]);
	layout.setKanbanSystemColumn(5, 'control', true);
	layout.setKanbanSystemColumn(5, 'control', true);
	layout.setKanbanSystemColumn(5, 'created', true);
	layout.setKanbanSystemColumn(5, 'unknown', true);
	expect(keys(layout, 5)).toEqual(['control', 'created']);
	expect(keys(layout, 7)).toEqual(['closed']);
	const restored = new LayoutStore(main, {}, { selected: 5 });
	expect(keys(restored, 5)).toEqual(['control', 'created']);
	restored.setKanbanSystemColumn(5, 'closed', true);
	expect(keys(restored, 5)).toEqual(['closed', 'control', 'created']);
	layout.setKanbanSystemColor(5, 'control', '#e53935');
	layout.setKanbanSystemColor(5, 'control', null);
	expect(layout.systemColumnsOf(5).find(column => column.key === 'control').color).toBeNull();
});
