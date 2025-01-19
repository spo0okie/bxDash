import { useContext } from "react";
import classNames from "classnames";
import { Tooltip } from "antd";
import { StoreContext } from "Data/Stores/StoreProvider";
import './HomeButton.css';

const HomeButton = (props)=>{
	//trace();
	const scrollDuration=1200;
	const context=useContext(StoreContext);
	const onClick=(e)=>{
		//window.location.href=("#"+task.uid);
		const today=context.layout.expand?context.time.today:context.time.monday0;
		//console.log('period'+today);
		context.layout.scrollTo('period'+today,scrollDuration);
		e.stopPropagation();
	}
	//console.log(props);

	return (
	<Tooltip title={'Перейти к "Сегодня"'} placement="rightBottom">
		<span 
			className={classNames(
				'clickable',
				'homeButton',
			)}
			
			onClick={onClick}
			
		>⌂</span>
	</Tooltip>);
}
export default HomeButton