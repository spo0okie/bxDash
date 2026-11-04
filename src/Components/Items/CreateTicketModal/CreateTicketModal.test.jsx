import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import CreateTicketModal from './CreateTicketModal';

jest.mock('Data/Stores/StoreProvider', () => ({ StoreContext: require('react').createContext(null) }));
// Обход ограничений CSS jsdom; Select и Modal остаются настоящими компонентами Ant Design.
jest.mock('@ant-design/cssinjs', () => ({ ...jest.requireActual('@ant-design/cssinjs'), useStyleRegister: () => node => node }));
jest.mock('rc-util/lib/getScrollBarSize', () => ({ __esModule: true, default: () => 0,
	getTargetScrollBarSize: () => ({ width: 0, height: 0 }) }));

/** Минимальный контекст формы с готовым справочником и временной заявкой. */
function setup(error = null) {
	const ticket = { isNew: true, isEdit: true, title: 'Заявка', user: 2, save: jest.fn() };
	const context = {
		main: { bx: { userId: 1 }, bxUsersList: [{ id: 1, name: 'Автор', login: 'author' }],
			ticketCategories: [{ id: 45, name: 'Оборудование' }, { id: 43, name: 'Поддержка' }],
			ticketCategoriesLoading: false, ticketCategoriesError: error,
			fetchTicketCategories: jest.fn(), fetchBxUsersList: jest.fn().mockResolvedValue([]) },
		layout: { ticketModalVisible: true, setTicketModalVisible: jest.fn() },
		items: { ticket: { items: new Map([[1, ticket]]) } },
		users: { order: [2], items: new Map([[2, { name: 'Исполнитель' }]]) },
	};
	render(<StoreContext.Provider value={context}><CreateTicketModal /></StoreContext.Provider>);
	return { ticket, context };
}

test('выбор категории в настоящем Select передаётся в стандартное сохранение', async () => {
	const { ticket } = setup();
	await waitFor(() => expect(screen.getByLabelText('Категория *').closest('.ant-select')).toHaveTextContent('Оборудование'));
	fireEvent.mouseDown(screen.getByLabelText('Категория *'));
	fireEvent.click(await screen.findByText('Поддержка', { selector: '.ant-select-item-option-content' }));
	fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
	expect(ticket.category).toBe(43);
	expect(ticket.save).toHaveBeenCalled();
});

test('ошибка справочника блокирует создание и позволяет повторить запрос', async () => {
	const { ticket, context } = setup('Категория не найдена');
	await screen.findByText('Категория не найдена');
	expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
	fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
	expect(context.main.fetchTicketCategories).toHaveBeenCalledTimes(2);
	expect(ticket.save).not.toHaveBeenCalled();
});
