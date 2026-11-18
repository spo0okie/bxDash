import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import ModalLink from './ModalLink';

jest.mock('Data/Stores/StoreProvider', () => ({ StoreContext: require('react').createContext(null) }));

const TASK_URL = '/company/personal/user/1/tasks/task/view/42/';
const originalBX = window.BX;

afterEach(() => {
	window.BX = originalBX;
	jest.restoreAllMocks();
});

/** Готовит ссылку карточки с подставным хранилищем модального окна. */
function setup(type = 'task', viewUrl = TASK_URL) {
	const item = { type, viewUrl, id: 42, title: 'Карточка', reload: jest.fn(), broadcastUpdate: jest.fn() };
	const layout = { setModal: jest.fn(), windowDimensions: { height: 900 } };
	render(<StoreContext.Provider value={{ layout }}><ModalLink item={item} /></StoreContext.Provider>);
	return { item, layout, link: screen.getByText('42: Карточка') };
}

test('задача открывается только в SidePanel без изменения истории и обновляется после закрытия', () => {
	const open = jest.fn().mockReturnValue(true);
	window.BX = { SidePanel: { Instance: { open } } };
	const { item, layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	expect(open).toHaveBeenCalledTimes(1);
	const [[url, options]] = open.mock.calls;
	expect(url).toBe(TASK_URL);
	expect(options.allowChangeHistory).toBe(false);
	expect(options.cacheable).toBe(false);
	expect(layout.setModal).not.toHaveBeenCalled();
	expect(item.reload).not.toHaveBeenCalled();

	// Эмулируем завершение закрытия штатной панели Bitrix.
	options.events.onCloseComplete();
	expect(item.reload).toHaveBeenCalledTimes(1);
	expect(item.broadcastUpdate).toHaveBeenCalledTimes(1);
});

test('задача без SidePanel открывается в прежней модалке', () => {
	window.BX = {};
	const { item, layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	const [[modal]] = layout.setModal.mock.calls;
	expect(modal.content.props.src).toBe(`${TASK_URL}?IFRAME=Y`);
	modal.onClose();
	expect(item.reload).toHaveBeenCalledTimes(1);
	expect(item.broadcastUpdate).toHaveBeenCalledTimes(1);
});

test('заявка использует модалку даже при доступном SidePanel', () => {
	const open = jest.fn();
	window.BX = { SidePanel: { Instance: { open } } };
	const { layout, link } = setup('ticket', '/bitrix/admin/ticket_edit.php?ID=42');
	fireEvent.mouseUp(link, { button: 0 });
	expect(layout.setModal).toHaveBeenCalledTimes(1);
	expect(open).not.toHaveBeenCalled();
});
