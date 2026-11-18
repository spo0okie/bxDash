import React, { useContext, useCallback } from "react";
import { StoreContext } from "Data/Stores/StoreProvider";
import { attachInventoryUserTtips } from "Helpers/InventoryUserTtip";

import "./ModalWindow.css";

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
	const openCard = useCallback(() => {
		const sidePanel = window.BX?.SidePanel?.Instance;
		if (item?.type === "task" && typeof sidePanel?.open === "function") {
			// Bitrix сам создаёт iframe панели и сохраняет адрес дашборда.
			sidePanel.open(href, {
				allowChangeHistory: false,
				cacheable: false,
				events: { onCloseComplete: refreshItem },
			});
			return;
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
