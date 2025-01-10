import React, { useContext }  from "react";
import './AppHeader.css';

import Menu from "./Menu/Menu";
import UserList from "./UserList/UserList";
import { StoreContext } from "Data/Stores/StoreProvider.js";
import { observer } from "mobx-react-lite";

const AppHeader=observer((props)=> {
	const context=useContext(StoreContext);
	const layout=context.layout;
	return (
		<div className="AppHeader">
			<Menu />
			<div className="layout">
				{layout.memosVisible && <div className="memo" style={{ width: layout.sidebarWidth }}>Заметки</div>}
				<div className="dashBoard">
					<UserList />
				</div>
			</div>
		</div>
	)
});
export default AppHeader;