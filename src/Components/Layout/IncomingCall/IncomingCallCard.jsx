import React, { useCallback, useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { Spin, Modal, message } from "antd";
import { useStores } from "Data/Stores/StoreProvider";
import TimeHelper from "Helpers/TimeHelper";
import { inventoryUrl, incomingCallConfig } from "config.priv";

const PHASE_LABEL = {
	callPolling: "Получение информации о звонке…",
	userSearching: "Поиск пользователя…",
	noCall: "Звонок не найден.",
	noUsers: "Пользователь не найден.",
	error: "Ошибка получения данных.",
};

const BODY_HEIGHT_PX = 600;

/**
 * Строку времени ast22 → unix-ms. Бэкенд ast22 отдаёт время в МСК (диалплан
 * пишет в МСК, web-UI с timeZone=Moscow так и показывает). Если в строке уже
 * есть TZ-маркер (Z или ±HH:MM) — доверяем ему.
 */
function toMs(s) {
	if (!s) return null;
	const str = String(s).trim();
	// Если в строке уже есть TZ-маркер (Z или ±HH[:MM]) — доверяем ему.
	const hasTz = /([zZ])|([+-]\d\d:?\d\d)$/.test(str);
	const iso =
		str.replace(" ", "T") + (hasTz ? "" : incomingCallConfig.sourceTimeOffset);
	const ms = Date.parse(iso);
	return isNaN(ms) ? null : ms;
}

/**
 * Форматирование через TimeHelper — учитывает выбранный пояс отображения
 * (МСК/локальный из TimeStore) и реактивно обновляется при переключении.
 * "…14:30:00" (МСК) → "18.06 14:30" в текущем поясе отображения.
 */
function formatTime(s) {
	const ms = toMs(s);
	if (ms === null) return s || "";
	const t = TimeHelper.objDate(ms);
	const p = (n) => TimeHelper.zeroPad(n);
	return `${p(t.D)}.${p(t.M)} ${p(t.h)}:${p(t.m)}`;
}

function recordTime(r) {
	return r?.created_at || r?.started_at || null;
}

/** Номер, на который перезванивать: callback_num (редактируем оператором),
 *  fallback на caller_num для записей без него. */
function recordCallbackNum(r) {
	return r?.callback_num || r?.caller_num || "";
}

/** Валидный номер для обратного вызова: цифры, "+", "*", "#"; 2–32 символа
 *  (ограничение колонки callback_num varchar(32) в ast22). */
function isValidCallbackNum(num) {
	return /^[0-9+*#]{2,32}$/.test(num);
}

/** URL голосового сообщения записи через сервис отдачи записей
 *  (http/elma365.php: /<call_uuid>-voicemail.wav, wav↔mp3 fallback на сервере).
 *  null — сервис не сконфигурирован или у записи нет call_uuid. */
function voiceUrl(r) {
	const base = incomingCallConfig.voiceBaseUrl;
	if (!base || !r?.call_uuid) return null;
	return `${base.replace(/\/+$/, "")}/${r.call_uuid}-voicemail.wav`;
}

/**
 * Тикающий счётчик «прошло с момента X». Читает time.strTime (обновляется
 * раз в секунду в TimeStore) → observer пересчитывает ежесекундно, как
 * SLA-отсчёт на тикетах. Само «сейчас» берём из TimeHelper.getTimestamp().
 */
const ElapsedSince = observer(({ since }) => {
	const { time } = useStores();
	void time.strTime; // подписка на ежесекундный тик
	const ms = toMs(since);
	if (ms === null) return null;
	const elapsed = TimeHelper.getTimestamp() - ms;
	if (elapsed < 0) return null;
	return <span className="elapsed">({TimeHelper.strRemaining(elapsed)})</span>;
});

const IncomingCallCard = observer(({ card }) => {
	const { incomingCalls } = useStores();
	// Map: userId → загружен ли iframe этого пользователя.
	const [loadedUsers, setLoadedUsers] = useState({});
	// Инлайн-редактирование номера обратного вызова (одна запись за раз).
	const [editingId, setEditingId] = useState(null);
	const [draftNum, setDraftNum] = useState("");
	const [savingNum, setSavingNum] = useState(false);
	// Проигрываемое голосовое (id записи); один плеер на карточку.
	const [playingId, setPlayingId] = useState(null);

	const onEditStart = useCallback((r) => {
		setEditingId(r.id);
		setDraftNum(recordCallbackNum(r));
	}, []);
	const onEditCancel = useCallback(() => {
		setEditingId(null);
		setDraftNum("");
	}, []);
	const onEditSave = useCallback(
		async (r) => {
			const num = draftNum.trim();
			if (!isValidCallbackNum(num) || savingNum) return;
			setSavingNum(true);
			try {
				await incomingCalls.updateCallbackNum(card, r, num);
				setEditingId(null);
				setDraftNum("");
			} catch (e) {
				message.error(`Не удалось сохранить номер: ${e.message}`);
			} finally {
				setSavingNum(false);
			}
		},
		[card, incomingCalls, draftNum, savingNum],
	);
	// Клик по номеру → подтверждение → originate через ast22 (сначала звонит
	// свой аппарат, после ответа набирается номер). Промис из onOk держит
	// кнопку модалки в состоянии loading до ответа API.
	const onCallClick = useCallback(
		(r) => {
			const num = recordCallbackNum(r);
			if (!num) return;
			Modal.confirm({
				title: `Позвонить на номер ${num}?`,
				content: `Сначала зазвонит ваш телефон ${card.myPhone}, после снятия трубки будет набран номер.`,
				okText: "Позвонить",
				cancelText: "Отмена",
				onOk: async () => {
					try {
						await incomingCalls.originateCall(num);
					} catch (e) {
						message.error(`Не удалось начать вызов: ${e.message}`);
					}
				},
			});
		},
		[card, incomingCalls],
	);

	const onToggle = useCallback(() => {
		if (card.collapsed) {
			incomingCalls.expandCard(card);
		} else {
			card.setCollapsed(true);
		}
	}, [card, incomingCalls]);
	// Pending/смешанную callback-группу закрыть нельзя — её должен «закрыть»
	// сам процесс обзвона (auto_done → подтверждение). Живые звонки закрываемы.
	const closeDisabled = card.kind === "callback" && !card.allAutoDone;
	const onClose = useCallback(() => {
		if (closeDisabled) return;
		// Карточка целиком в auto_done (диалплан распознал ответ) — при закрытии
		// спрашиваем подтверждение и переводим заявки в done на сервере.
		if (card.allAutoDone) {
			Modal.confirm({
				title: "Отметить обратные звонки выполненными?",
				okText: "Да, выполнены",
				cancelText: "Отмена",
				onOk: async () => {
					await incomingCalls.markCallbacksDone(card);
					incomingCalls.dismissCard(card);
				},
			});
			return;
		}
		incomingCalls.dismissCard(card);
	}, [card, incomingCalls, closeDisabled]);
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

	const isGroup = card.kind === "callback";
	// Записи в свёрнутом виде: голосовые показываем всегда (требуют действия —
	// прослушать), простые обратные вызовы прячем.
	const visibleRecords = card.records.filter(
		(r) => !card.collapsed || r.request_type === "voicemail",
	);

	return (
		<div
			className={classNames("IncomingCallCard", {
				collapsed: card.collapsed,
				callback: isGroup,
				autoDone: card.allAutoDone,
			})}
		>
			<div className="header">
				<span className="title">{card.title}</span>
				{isGroup && card.multiplier > 1 && (
					<span
						className="multiplier"
						onClick={onToggle}
						title="Показать все записи"
					>
						×{card.multiplier}
					</span>
				)}
				{card.earliestTime && (
					<span className="cardTime">
						{formatTime(card.earliestTime)}
						<ElapsedSince since={card.earliestTime} />
					</span>
				)}
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
					<button
						onClick={onClose}
						disabled={closeDisabled}
						title={closeDisabled ? "Сначала надо перезвонить" : "Закрыть"}
					>
						×
					</button>
				</div>
			</div>

			{/* Список записей группы. Рендерится и при collapsed — чтобы голосовые
			    оставались видны (дата + Play). Простые при collapsed скрыты. */}
			{isGroup && visibleRecords.length > 0 && (
				<div className="recordList">
					{visibleRecords.map((r) => {
						const isVoice = r.request_type === "voicemail";
						const num = recordCallbackNum(r);
						const isEdited =
							r.callback_num && r.caller_num && r.callback_num !== r.caller_num;
						const isEditing = r.id === editingId;
						// Менять номер имеет смысл только у ещё не перезвоненных заявок.
						const canEdit = r.status === "pending";
						const url = isVoice ? voiceUrl(r) : null;
						return (
							<React.Fragment key={r.id}>
							<div className={classNames("record", { voicemail: isVoice })}>
								<span className="recTime">{formatTime(recordTime(r))}</span>
								<span className="recType">
									{isVoice ? "голосовое сообщение" : "обратный вызов"}
								</span>
								{isEditing ? (
									<span className="recNumEdit">
										<input
											value={draftNum}
											maxLength={32}
											autoFocus
											disabled={savingNum}
											onChange={(e) => setDraftNum(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") onEditSave(r);
												if (e.key === "Escape") onEditCancel();
											}}
										/>
										<button
											className="okBtn"
											disabled={savingNum || !isValidCallbackNum(draftNum.trim())}
											onClick={() => onEditSave(r)}
											title="Сохранить номер"
										>
											✓
										</button>
										<button
											className="cancelBtn"
											disabled={savingNum}
											onClick={onEditCancel}
											title="Отменить"
										>
											✕
										</button>
									</span>
								) : (
									<>
										<span
											className={classNames("recNum", { edited: isEdited })}
											onClick={() => onCallClick(r)}
											title={
												`Позвонить на ${num}` +
												(isEdited
													? ` (номер изменён оператором, исходный ${r.caller_num})`
													: "")
											}
										>
											{num}
										</span>
										{canEdit && (
											<button
												className="editBtn"
												onClick={() => onEditStart(r)}
												title="Изменить номер для обратного вызова"
											>
												✎
											</button>
										)}
									</>
								)}
								{isVoice && (
									<button
										className="playBtn"
										disabled={!url}
										title={
											!url
												? "Воспроизведение недоступно (не настроен voiceBaseUrl)"
												: r.id === playingId
													? "Остановить"
													: "Прослушать голосовое сообщение"
										}
										onClick={() =>
											setPlayingId(r.id === playingId ? null : r.id)
										}
									>
										{r.id === playingId ? "■" : "▶"}
									</button>
								)}
							</div>
							{/* Плеер отдельной строкой под записью; размонтирование
							    по повторному клику/onEnded останавливает звук. */}
							{isVoice && r.id === playingId && (
								<div className="voicePlayer">
									<audio
										controls
										autoPlay
										src={url}
										onEnded={() => setPlayingId(null)}
										onError={() => {
											message.error(
												"Не удалось загрузить голосовое сообщение",
											);
											setPlayingId(null);
										}}
									/>
								</div>
							)}
							</React.Fragment>
						);
					})}
				</div>
			)}

			{/* Body (iframe) всегда в DOM: при collapsed скрываем display:none,
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
