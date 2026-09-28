import React from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import "./Notifications.css";

const ICONS = { success: '✓', info: 'i', warning: '!', error: '✕' };

/**
 * Стек всплывающих уведомлений в правом нижнем углу.
 * Новые — снизу. Наведение ставит автоскрытие на паузу, крестик закрывает.
 */
const NotificationsStack = observer(() => {
	const { notifications } = useStores();
	if (!notifications || notifications.items.length === 0) return null;
	return (
		<div className="NotificationsStack" role="log" aria-live="polite">
			{notifications.items.map(n => (
				<div
					key={n.id}
					className={'Notification ' + n.level}
					role={n.level === 'error' ? 'alert' : 'status'}
					onMouseEnter={() => notifications.pause(n.id)}
					onMouseLeave={() => notifications.resume(n.id)}
				>
					<span className="icon">{ICONS[n.level] ?? 'i'}</span>
					<div className="content">
						{n.title && <div className="title">{n.title}</div>}
						<div className="text">{n.text}</div>
					</div>
					<span className="time">{n.time.toLocaleTimeString('ru-RU')}</span>
					<button className="close" title="Закрыть" onClick={() => notifications.dismiss(n.id)}>×</button>
				</div>
			))}
		</div>
	);
});

export default NotificationsStack;
