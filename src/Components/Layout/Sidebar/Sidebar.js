import React, { useContext } from "react";
import { useState, useEffect, useRef } from "react";
import './Sidebar.css';
import { StoreContext } from "Data/Stores/StoreProvider";
import { observer } from "mobx-react";

const Sidebar=observer((props)=>{

	const sidebarRef = useRef(null);
	const context = useContext(StoreContext);
	const layout=context.layout;
	const [isResizing, setIsResizing] = useState(false);

	const startResizing = React.useCallback((mouseDownEvent) => {
		setIsResizing(true);
	}, []);

	const stopResizing = React.useCallback(() => {
		setIsResizing(false);
	}, []);

	const resize = React.useCallback(
		(mouseMoveEvent) => {
			if (isResizing) {
				layout.setSidebarWidth(
					mouseMoveEvent.clientX -
					sidebarRef.current.getBoundingClientRect().left+2 //+2 - ширина ресайзбара
				);
			}
		},
		[isResizing,layout]
	);

	React.useEffect(() => {
		window.addEventListener("mousemove", resize);
		window.addEventListener("mouseup", stopResizing);
		return () => {
			window.removeEventListener("mousemove", resize);
			window.removeEventListener("mouseup", stopResizing);
		};
	}, [resize, stopResizing]);

	return (
			<div
				ref={sidebarRef}
				className="App-Sidebar"
				style={{ width: layout.sidebarWidth }}
				onMouseDown={(e) => {if (isResizing) e.preventDefault()}}
			>
			<div className="App-Sidebar-content">{props.children}</div>
			<div className="App-Sidebar-resizer" onMouseDown={startResizing} />
			</div>
	);
});

export default Sidebar;