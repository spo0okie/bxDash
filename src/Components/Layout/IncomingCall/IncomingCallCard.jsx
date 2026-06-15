import React, { useCallback, useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { Spin } from "antd";
import { useStores } from "Data/Stores/StoreProvider";
import { inventoryUrl, incomingCallConfig } from "config.priv";

const PHASE_LABEL = {
	callPolling: "Получение информации о звонке…",
	userSearching: "Поиск пользователя…",
	noCall: "Звонок не найден.",
	noUsers: "Пользователь не найден.",
	error: "Ошибка получения данных.",
};

const BODY_HEIGHT_PX = 600;
const HEADER_HEIGHT_PX = 25;

const IncomingCallCard = observer(({ card }) => {
	const { incomingCalls } = useStores();
	// Map: userId → загружен ли iframe этого пользователя.
	// Все iframe'ы рендерятся одновременно при первом получении users,
	// чтобы переключение вкладок не перегружало содержимое.
	const [loadedUsers, setLoadedUsers] = useState({});

	const onToggle = useCallback(() => {
		if (card.collapsed) {
			incomingCalls.expandCard(card);
		} else {
			card.setCollapsed(true);
		}
	}, [card, incomingCalls]);
	const onClose = useCallback(() => {
		incomingCalls.dismissCard(card);
	}, [card, incomingCalls]);
	const onTabClick = useCallback(
		(id) => {
			card.setActiveUserId(id);
			if (card.collapsed) incomingCalls.expandCard(card);
		},
		[card, incomingCalls],
	);
	const onIframeLoad = useCallback(
		(userId) => () => setLoadedUsers((prev) => ({ ...prev, [userId]: true })),
		[],
	);

	const isBusyPhase =
		card.phase === "callPolling" || card.phase === "userSearching";
	const hasUsers = card.users.length > 0;
	const activeLoaded = card.activeUserId
		? !!loadedUsers[card.activeUserId]
		: false;
	const showSpinner = (hasUsers && !activeLoaded) || (!hasUsers && isBusyPhase);
	const spinnerText = hasUsers ? "Загрузка карточки…" : PHASE_LABEL[card.phase];

	const cardHeight = card.collapsed
		? `${HEADER_HEIGHT_PX}px`
		: `${HEADER_HEIGHT_PX + BODY_HEIGHT_PX}px`;

	return (
		<div
			className={classNames("IncomingCallCard", {
				collapsed: card.collapsed,
				callback: card.kind === 'callback',
			})}
			style={{ height: cardHeight }}
		>
			<div className="header">
				<span className="title">{card.title}</span>
				{hasUsers && (
					<div className="tabs">
						{card.users.map((u) => (
							<div
								key={u.id}
								className={classNames("tab", {
									active: u.id === card.activeUserId,
								})}
								onClick={() => onTabClick(u.id)}
								title={u.ename}
							>
								{u.shortName || u.ename || u.login}
							</div>
						))}
					</div>
				)}
				<div className="controls">
					<button
						onClick={onToggle}
						title={card.collapsed ? "Развернуть" : "Свернуть"}
					>
						{card.collapsed ? "▼" : "▲"}
					</button>
					<button onClick={onClose} title="Закрыть">
						×
					</button>
				</div>
			</div>
			{/* Body всегда отрисован: при collapsed скрываем через display:none,
			    чтобы iframe не перезагружался при разворачивании. */}
			<div
				className="body"
				style={{
					display: card.collapsed ? "none" : "block",
					height: `${BODY_HEIGHT_PX}px`,
				}}
			>
				{card.users.map((u) => (
					<iframe
						key={u.id}
						title={`user-${u.id}`}
						src={`${inventoryUrl}users/view?id=${u.id}&_layout=embed`}
						className="userFrame"
						style={{
							...zoomStyle(incomingCallConfig.iframeZoom),
							display: u.id === card.activeUserId ? "block" : "none",
						}}
						onLoad={onIframeLoad(u.id)}
					/>
				))}
				{showSpinner && (
					<div className="loaderOverlay">
						<Spin tip={spinnerText} size="large" />
					</div>
				)}
				{!hasUsers && !isBusyPhase && (
					<div className="placeholder">{PHASE_LABEL[card.phase]}</div>
				)}
			</div>
		</div>
	);
});

function zoomStyle(zoom) {
	if (!zoom || zoom === 1) return undefined;
	const inv = 100 / zoom;
	return {
		transform: `scale(${zoom})`,
		transformOrigin: "top left",
		width: `${inv}%`,
		height: `${inv}%`,
	};
}

export default IncomingCallCard;
