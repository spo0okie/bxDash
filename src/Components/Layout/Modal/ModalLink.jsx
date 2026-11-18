import React, { useContext, useCallback } from "react";
import { StoreContext } from "Data/Stores/StoreProvider";
import { attachInventoryUserTtips } from "Helpers/InventoryUserTtip";
import { waitForBitrixLibraries } from "Helpers/BitrixLibraries";
import notify from "Helpers/Notify";

import "./ModalWindow.css";

/** Показывает причину сбоя открытия задачи. */
function reportTaskOpenError(id, error) {
	notify.error(notify.describe(error), { title: `Не удалось открыть задачу ${id}` });
}

/** Открывает задачу в SidePanel и сохраняет жизненный цикл штатной карточки Bitrix. */
function openTaskSidePanel(bx, item, refreshItem) {
	const { id, viewUrl } = item;
	const sidePanel = bx.SidePanel.Instance;
	const TaskFullCard = bx.Tasks?.V2?.Application?.TaskFullCard;
	let card;
	const options = {
		allowChangeHistory: false,
		cacheable: false,
		events: {
			onClose: event => card?.onClose(event),
			onCloseComplete: () => {
				card?.onCloseComplete();
				refreshItem();
			},
		},
	};
	if (typeof TaskFullCard === 'function') {
		// Сервер уже подключил карточку вместе с ресурсами. В iframe Bitrix вернул бы только запускающий скрипт.
		options.contentCallback = async slider => {
			try {
				card = new TaskFullCard({ taskId: Number(id), url: viewUrl, focusVisible: false });
				await card.mount(slider);
			} catch (error) {
				reportTaskOpenError(id, error);
				slider.close();
			}
		};
	}
	if (sidePanel.open(viewUrl, options) === false && sidePanel.getTopSlider?.()?.getUrl?.() !== viewUrl) {
		throw new Error('Bitrix отказался открыть боковую панель');
	}
}

/** Открывает карточку из дашборда и обновляет её данные после закрытия. */
const ModalLink = (props) => {
	const context = useContext(StoreContext);
	const layout = context.layout;
	const item = props.item;
	const link = props.link;
	const content =
		item !== undefined ? item.id + ": " + item.title : props.children;
	const title = props.title !== undefined ? props.title : content;
	const href = item !== undefined ? item.viewUrl : link;

	/** Обновляет карточку в текущем дашборде и оповещает другие клиенты. */
	const refreshItem = useCallback(() => {
		if (item !== undefined) {
			item.reload();
			item.broadcastUpdate();
		}
	}, [item]);

	/** Открывает задачи в SidePanel, если он доступен на портале. */
	const openCard = useCallback(async () => {
		if (item?.type === "task") {
			try {
				// Клик во время запуска ждёт тот же запрос, который подключает BX и карточку.
				await waitForBitrixLibraries();
				const bx = window.BX;
				if (typeof bx?.SidePanel?.Instance?.open === "function") {
					openTaskSidePanel(bx, item, refreshItem);
					return;
				}
			} catch (error) {
				reportTaskOpenError(item.id, error);
				return;
			}
		}

		layout.setModal({
			title: content,
			content: (
				<iframe
					title={title}
					width={"100%"}
					height={layout.windowDimensions.height - 110 + "px"}
					src={href + "?IFRAME=Y"}
					// в заявках профиль пользователя показываем из Inventory, а не битриксовый
					onLoad={
						item?.type === "ticket"
							? (e) => attachInventoryUserTtips(e.currentTarget, context.main)
							: undefined
					}
				/>
			),
			onClose: refreshItem,
		});
	}, [layout, context.main, item, content, title, href, refreshItem]);

	// Открыть ссылку в новом окне
	const openInNewWindow = useCallback(() => {
		window.open(href, "_blank");
	}, [href]);

	// Обработчик отпускания кнопки мыши
	const onMouseUp = useCallback(
		(e) => {
			if (e.button === 1) {
				openInNewWindow();
				e.preventDefault();
				e.stopPropagation();
			}

			if (e.button === 0) {
				openCard();
				e.preventDefault();
				e.stopPropagation();
			}
		},
		[openCard, openInNewWindow],
	);

	// Обработчик нажатия кнопки мыши
	const onMouseDown = useCallback((e) => {
		if (e.button === 1) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, []);

	const innerTitle = { __html: content };

	return (
		<span
			className="clickable"
			onMouseUp={onMouseUp}
			onMouseDown={onMouseDown}
			lang="ru"
			dangerouslySetInnerHTML={innerTitle}
		/>
	);
};

export default ModalLink;
