import React from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";

import AppHeader from "./Header/AppHeader";
import InvAuthForm from "./AuthForm/InvAuthForm";
import HomeButton from "./Header/HomeButton";
import MenuButton from "./Header/Menu/MenuIButton";
import TaskSearch from "./TaskSearch/TaskSearch";
import Sidebar from "./Sidebar/Sidebar";
import MemoCell from "./Sidebar/MemoCell";
import Modals from "./Modals";
import CalendarGrid from "./CalendarGrid";
import RightPaneBucket from "./RightPaneBucket";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

import "./Layout.css";
import "./Header/HomeButton.css";

/**
 * Корневой layout приложения: топбар, sidebar, calendar grid и опциональная правая панель.
 * Подкомпоненты:
 *   - Modals — модальные окна (iframe + создание заявки)
 *   - CalendarGrid — основная область с интервалами и корзиной
 *   - RightPaneBucket — правая панель с корзиной (только в personal-режиме)
 *   - useGlobalShortcuts — Ctrl+K / Escape
 */
const Layout = observer(() => {
	const { users, layout, main, ws, items } = useStores();

	useGlobalShortcuts(items);

	const personal = users.selected !== null;

	// Форма авторизации показывается при проблемах с auth/WS или в режиме отладки
	const showAuthForm = main.bx.authStatus !== 'OK'
		|| main.zabbix.authStatus !== 'OK'
		|| main.inventory.authStatus !== 'OK'
		|| !ws.connectionStatus
		|| layout.debugVisible;

	return (
		<>
			{showAuthForm && <InvAuthForm />}

			<Modals />

			<AppHeader />
			<TaskSearch />
			<HomeButton />
			<MenuButton property='memosVisible' title='📝' classNames='memoButton' />
			<MenuButton property='debugVisible' title='⚙️' classNames='optionsButton' />
			<MenuButton property='expand' title={['📅', '📆']} classNames='calendarButton' />

			<div className="layout">
				{layout.memosVisible && (
					<Sidebar>
						<MemoCell />
					</Sidebar>
				)}

				<div className="dashBoard">
					<CalendarGrid />
				</div>

				{personal && <RightPaneBucket />}
			</div>
		</>
	);
});

export default Layout;
