import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreContext } from 'Data/Stores/StoreProvider';
import { waitForBitrixLibraries } from 'Helpers/BitrixLibraries';
import notify from 'Helpers/Notify';
import ModalLink from './ModalLink';

jest.mock('Data/Stores/StoreProvider', () => ({ StoreContext: require('react').createContext(null) }));
jest.mock('Helpers/BitrixLibraries', () => ({ waitForBitrixLibraries: jest.fn() }));

const TASK_URL = '/company/personal/user/1/tasks/task/view/42/';
const originalBX = window.BX;

afterEach(() => {
	window.BX = originalBX;
	waitForBitrixLibraries.mockReset();
	jest.restoreAllMocks();
});

/** Готовит ссылку карточки с подставным хранилищем модального окна. */
function setup(type = 'task', viewUrl = TASK_URL) {
	const item = { type, viewUrl, id: 42, title: 'Карточка', reload: jest.fn(), broadcastUpdate: jest.fn() };
	const layout = { setModal: jest.fn(), windowDimensions: { height: 900 } };
	render(<StoreContext.Provider value={{ layout }}><ModalLink item={item} /></StoreContext.Provider>);
	return { item, layout, link: screen.getByText('42: Карточка') };
}

test('старая карточка открывается в SidePanel при отсутствии TaskFullCard', async () => {
	const open = jest.fn().mockReturnValue(true);
	window.BX = { SidePanel: { Instance: { open } } };
	const { item, layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
	const [[url, options]] = open.mock.calls;
	expect(url).toBe(TASK_URL);
	expect(options.allowChangeHistory).toBe(false);
	expect(options.cacheable).toBe(false);
	expect(options.contentCallback).toBeUndefined();
	expect(layout.setModal).not.toHaveBeenCalled();
	expect(item.reload).not.toHaveBeenCalled();

	// Эмулируем завершение закрытия штатной панели Bitrix.
	options.events.onCloseComplete();
	expect(item.reload).toHaveBeenCalledTimes(1);
	expect(item.broadcastUpdate).toHaveBeenCalledTimes(1);
});

test('TaskFullCard монтируется в панели и закрывается без перехода на список задач', async () => {
	const open = jest.fn();
	const card = { mount: jest.fn().mockResolvedValue(undefined), onClose: jest.fn(), onCloseComplete: jest.fn() };
	const TaskFullCard = jest.fn().mockImplementation(() => card);
	const loadExtension = jest.fn(() => new Promise(() => {}));
	window.BX = { SidePanel: { Instance: { open } }, Runtime: { loadExtension } };
	let finishLoading;
	waitForBitrixLibraries.mockReturnValue(new Promise(resolve => { finishLoading = resolve; }));
	const { item, layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	expect(open).not.toHaveBeenCalled();
	// Класс экспортируется при завершении общего подключения ресурсов портала.
	window.BX.Tasks = { V2: { Application: { TaskFullCard } } };
	finishLoading();
	await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
	expect(loadExtension).not.toHaveBeenCalled();
	const [[url, options]] = open.mock.calls;
	expect(url).toBe(TASK_URL);
	expect(options.allowChangeHistory).toBe(false);
	expect(layout.setModal).not.toHaveBeenCalled();
	// SidePanel вызывает contentCallback для своей DOM-панели и передаёт событие закрытия карточке.
	const slider = {};
	await options.contentCallback(slider);
	expect(TaskFullCard).toHaveBeenCalledWith({ taskId: 42, url: TASK_URL, focusVisible: false });
	expect(card.mount).toHaveBeenCalledWith(slider);
	const event = {};
	options.events.onClose(event);
	expect(card.onClose).toHaveBeenCalledWith(event);
	expect(item.reload).not.toHaveBeenCalled();
	options.events.onCloseComplete();
	expect(card.onCloseComplete).toHaveBeenCalledTimes(1);
	expect(item.reload).toHaveBeenCalledTimes(1);
	expect(item.broadcastUpdate).toHaveBeenCalledTimes(1);
});

test('при ошибке подключения ресурсов показывает причину и не открывает пустую панель', async () => {
	const open = jest.fn();
	waitForBitrixLibraries.mockImplementation(() => Promise.reject(new Error('Сбой загрузки Bitrix')));
	const reportError = jest.spyOn(notify, 'error').mockImplementation(() => {});
	window.BX = { SidePanel: { Instance: { open } } };
	const { layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	await waitFor(() => expect(reportError).toHaveBeenCalledWith('Сбой загрузки Bitrix', { title: 'Не удалось открыть задачу 42' }));
	expect(open).not.toHaveBeenCalled();
	expect(layout.setModal).not.toHaveBeenCalled();
});

test('отказ SidePanel открыть задачу показывает уведомление', async () => {
	window.BX = { SidePanel: { Instance: { open: jest.fn().mockReturnValue(false) } } };
	const reportError = jest.spyOn(notify, 'error').mockImplementation(() => {});
	const { link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	await waitFor(() => expect(reportError).toHaveBeenCalledWith('Bitrix отказался открыть боковую панель', { title: 'Не удалось открыть задачу 42' }));
});

test('задача без SidePanel открывается в прежней модалке', async () => {
	window.BX = {};
	const { item, layout, link } = setup();
	fireEvent.mouseUp(link, { button: 0 });
	await waitFor(() => expect(layout.setModal).toHaveBeenCalledTimes(1));
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
