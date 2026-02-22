import React, {useContext, useCallback} from "react";
import { StoreContext } from "Data/Stores/StoreProvider";

import './ModalWindow.css'

const ModalLink = (props)=>{
	//trace();
	const context=useContext(StoreContext);
	const layout = context.layout;
	const item=props.item;
	const link=props.link;
	const content = item !== undefined ? item.id + ': ' + item.title:props.children;
	const title = props.title !== undefined ? props.title : content;
	const href = item !== undefined ? item.viewUrl : link;

	// Открыть ссылку в модальном окне
	const openInModal=useCallback(()=>{
		console.log(item);
		layout.setModal({
			title: content,
			content: <iframe title={title} width={'100%'} height={(layout.windowDimensions.height - 110) + 'px'} src={href +'?IFRAME=Y'}/>,
			onClose:()=>{if (item!==undefined){item.reload();item.broadcastUpdate();}},
		});
	}, [layout, item, content, title, href])

	// Открыть ссылку в новом окне
	const openInNewWindow=useCallback(()=>{
		window.open(href, "_blank");
	}, [href])

	// Обработчик отпускания кнопки мыши
	const onMouseUp=useCallback((e)=>{
		if (e.button === 1) {
			openInNewWindow();
			e.preventDefault();
			e.stopPropagation();
		}

		if (e.button === 0 ) {
			openInModal();
			e.preventDefault();
			e.stopPropagation();
		}
	}, [openInModal, openInNewWindow])

	// Обработчик нажатия кнопки мыши
	const onMouseDown=useCallback((e)=>{
		if (e.button === 1) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, [])

	const innerTitle = { __html: content }

	return(
		<span className="clickable" onMouseUp={onMouseUp} onMouseDown={onMouseDown} dangerouslySetInnerHTML={innerTitle} />
	);
}

export default ModalLink;