import React from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";

import AppHeader from "./Header/AppHeader";
import ControlPanel from "./ControlPanel/ControlPanel";
import HomeButton from "./Header/HomeButton";
import MenuButton from "./Header/Menu/MenuIButton";
import TaskSearch from "./TaskSearch/TaskSearch";
import Sidebar from "./Sidebar/Sidebar";
import MemoCell from "./Sidebar/MemoCell";
import Modals from "./Modals";
import IncomingCallsStack from "./IncomingCall/IncomingCallsStack";
import NotificationsStack from "./Notifications/NotificationsStack";
import CalendarGrid from "./CalendarGrid";
import RightPaneBucket from "./RightPaneBucket";
import KanbanBoard from "./Kanban/KanbanBoard";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

import "./Layout.css";
import "./Header/HomeButton.css";

/**
 * Корневой layout приложения: топбар, sidebar, calendar grid и опциональная правая панель.
 * Подкомпоненты:
 *   - Modals — модальные окна (iframe + создание заявки)
 *   - CalendarGrid — основная область с интервалами и корзиной
 *   - RightPaneBucket — правая панель с корзиной (только в personal-режиме)
 *   - KanbanBoard — канбан-раскладка персональной доски (вместо CalendarGrid и RightPaneBucket)
 *   - useGlobalShortcuts — Ctrl+K / Escape
 */
const Layout = observer(() => {
	const { users, layout, main, ws, items } = useStores();

	useGlobalShortcuts(items);

	const personal = users.selected !== null;
	// канбан — альтернативная раскладка персональной доски: столбцы вместо оси времени
	const kanban = layout.kanbanActive;

	// Форма авторизации показывается при проблемах с auth/WS или в режиме отладки
	const showAuthForm = main.bx.authStatus !== 'OK'
		|| main.zabbix.authStatus !== 'OK'
		|| main.inventory.authStatus !== 'OK'
		|| !ws.connectionStatus
		|| layout.debugVisible;

	return (
		<>
			{showAuthForm && <ControlPanel />}

			<Modals />
			<IncomingCallsStack />
			<NotificationsStack />

			<AppHeader />
			<TaskSearch />
			{!kanban && <HomeButton />}
			<MenuButton property='memosVisible' title='📝' classNames='memoButton' />
			<MenuButton property='debugVisible' title='⚙️' classNames='optionsButton' />
			{!kanban && <MenuButton property='expand' title={['📅', '📆']} classNames='calendarButton' />}
			{personal && <MenuButton property='kanban' title={['🗓️', '🗂️']} classNames='kanbanButton' />}

			<div className="layout">
				{layout.memosVisible && (
					<Sidebar>
						<MemoCell />
					</Sidebar>
				)}

				{kanban ? <KanbanBoard /> : (
					<div className="dashBoard">
						<CalendarGrid />
					</div>
				)}

				{personal && !kanban && <RightPaneBucket />}
			</div>
		</>
	);
});

export default Layout;
