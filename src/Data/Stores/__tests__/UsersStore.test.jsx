import { observable } from 'mobx';
import UsersStore from '../UsersStore';

/** Создаёт хранилище с сохранением настроек между перезагрузками. */
function createStore(options) {
	return new UsersStore({
		bx: observable({ userId: null }),
		loadOption: name => options.get(name),
		saveOption: (name, value) => options.set(name, value),
	});
}

test('сохранённый порядок при загрузке очищается от дублей', () => {
	const savedOrder = [3, 1, 1, 2, 3];
	const options = new Map([['users.order', savedOrder]]);
	expect(createStore(options).order).toEqual([3, 1, 2]);
	expect(options.get('users.order')).toBe(savedOrder);
});

test('сброс на левую грань правой соседки оставляет порядок без дублей', () => {
	const savedOrder = [1, 2, 3];
	const options = new Map([['users.order', savedOrder]]);
	const store = createStore(options);
	store.moveUser(1, 2, 'left');
	expect(store.order).toEqual([1, 2, 3]);
	expect(options.get('users.order')).toBe(savedOrder);
});

test('перемещение по обеим граням сохраняет порядок после перезагрузки', () => {
	const options = new Map([['users.order', [1, 2, 3]]]);
	const store = createStore(options);
	store.moveUser(1, 3, 'right');
	expect(createStore(options).order).toEqual([2, 3, 1]);
	store.moveUser(1, 2, 'left');
	expect(createStore(options).order).toEqual([1, 2, 3]);
});
