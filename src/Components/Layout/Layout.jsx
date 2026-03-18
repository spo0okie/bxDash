import React, { useContext } from "react";
import { observer } from "mobx-react";
import { StoreContext } from "Data/Stores/StoreProvider";
import AppHeader from "./Header/AppHeader";
import InvAuthForm from "./AuthForm/InvAuthForm";
import Interval from "./Interval/Interval";
import ModalWindow from "./Modal/ModalWindow";
import CreateTicketModal from "Components/Items/CreateTicketModal/CreateTicketModal";
import classNames from "classnames";
import "./Layout.css";
import MemoCell from "../MemoCell/MemoCell";
import Sidebar from "./Sidebar/Sidebar";
import ScrollSection from "./ScrollSection/ScrollSection";
import HomeButton from "./Header/Buttons/HomeButton";
import MenuButton from "./Header/Menu/MenuIButton";
import "./Header/Buttons/HomeButton.css";

/**
 * Главный компонент layout приложения
 * Отвечает за отображение структуры страницы: сайдбар, календарь, модальные окна
 */
const Layout = observer(() => {
	// Получаем контекст хранилищ
	const context = useContext(StoreContext);
	const time = context.time;
	const users = context.users;
	const layout = context.layout;
	const main = context.main;
	const ws = context.ws;

	
	// Флаг персонального режима (выбран конкретный пользователь)
	const personal = (users.selected !== null);
	const splitBucket = layout.useSplitBucket;

	//console.log('layout render');
	
	return (
		<>
			{/* Форма авторизации показывается при проблемах с аутентификацией или в режиме отладки */}
			{(main.bx.authStatus !== 'OK' || main.zabbix.authStatus !== 'OK' || main.inventory.authStatus !== 'OK' || !ws.connectionStatus || layout.debugVisible) && <InvAuthForm />}
			
			<>
				<ModalWindow />
				<CreateTicketModal />

				<AppHeader />
				<HomeButton />
				<MenuButton property='memosVisible' title='📝' classNames='memoButton' />
				<MenuButton property='debugVisible' title='⚙️' classNames='optionsButton' />
				<MenuButton property='expand' title={['📅', '📆']} classNames='calendarButton' />
				
				<div className="layout">
					{/* Сайдбар с заметками */}
					{layout.memosVisible && (
						<Sidebar>
							<MemoCell />
						</Sidebar>
					)}
					
					<div className="dashBoard">
						{/* Основная область календаря */}
						<ScrollSection
							className={classNames(
								"Calendar",
								{ 'ColumnScroller': personal && !layout.expand }
							)}
							id='calendarGrid'
							style={{
								width: (personal && !layout.expand)
									? (layout.windowDimensions.width - 200 - (layout.memosVisible ? layout.sidebarWidth : 0)) + 'px'
									: null
							}}
						>
							{time.weeksRange(false).map((i) => <Interval key={i} id={i} />)}
							{!personal&&(splitBucket?
								[2,1,0].map((i) => (<Interval 
									key={(time.weekMax + 1)+'-'+i} 
									id={time.weekMax + 1} 
									priority={i}
								/>)):(<Interval 
									key={(time.weekMax + 1)} 
									id={time.weekMax + 1} 
								/>)
							)}
						</ScrollSection>
					</div>
					
					{/* Правая панель для персонального режима */}
					{personal && (
						<div className={classNames("rightPane", { 'x3': layout.useSplitBucket })}>
							{(splitBucket?
								[2,1,0].map((i) => (<Interval 
									key={(time.weekMax + 1)+'-'+i} 
									id={time.weekMax + 1} 
									priority={i}
								/>)):(<Interval 
									key={(time.weekMax + 1)} 
									id={time.weekMax + 1} 
								/>)
							)}
						</div>
					)}
				</div>
			</>
		</>
	);
});

export default Layout;
