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
import MemoCell from "./Sidebar/MemoCell";
import Sidebar from "./Sidebar/Sidebar";
import ScrollSection from "./ScrollSection/ScrollSection";
import HomeButton from "./Header/HomeButton";
import MenuButton from "./Header/Menu/MenuIButton";
import "./Header/HomeButton.css";
// Импорт компонентов поиска задач
import TaskSearch from "./TaskSearch/TaskSearch";
import SearchResults from "./SearchResults/SearchResults";

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
	const items = context.items; // Хранилище элементов для доступа к task store (поиск)

	
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
				<TaskSearch /> {/* Компонент поиска задач в шапке */}
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
									? (layout.windowDimensions.width - (layout.useSplitBucket?450:200) - (layout.memosVisible ? layout.sidebarWidth : 0)) + 'px'
									: null
							}}
						>
							{/* SearchResults отображается поверх календаря через absolute positioning */}
							{items.task.searchMode && <SearchResults />}
							{/* Показываем календарь только когда поиск неактивен */}
							{!items.task.searchMode && time.weeksRange(false).map((i) => <Interval key={i} id={i} />)}
							{/* Bucket отображается только когда поиск неактивен */}
							{!personal && !items.task.searchMode && (splitBucket?
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
