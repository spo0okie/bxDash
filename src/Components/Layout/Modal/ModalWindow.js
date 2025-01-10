import React, { Fragment, useContext } from "react";
import { Modal } from "antd";
import { observer } from "mobx-react";
import { StoreContext } from "Data/Stores/StoreProvider";
import './ModalWindow.css'
const ModalWindow=observer((props)=> {
	const context=useContext(StoreContext);
	const layout=context.layout;
	const onClose=()=>{
		console.log('closin modal');
		console.log(layout.modal);
		if (layout.modal!==null && typeof layout.modal.onClose === 'function') 
			layout.modal.onClose();
		layout.setModal(null);
	}

	console.log ('render.modal '+layout.modalVisible);
	return (<Modal
		open={layout.modalVisible}
		title={layout.modal!==null?layout.modal.title:null}
		style={{ top: 20, padding:0}}
		width={1200}
		footer={null}
		onCancel={onClose}
		className={'bxModal'}
		>
		{layout.modal!==null?layout.modal.content:null}
	</Modal>)
});
export default ModalWindow;