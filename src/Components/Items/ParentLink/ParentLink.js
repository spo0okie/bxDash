import TaskLink from "../ItemCards/Task/TaskLink";
import TicketLink from "../ItemCards/Ticket/TicketLink";

const ParentLink=(props)=>{
	const item=props.item;
	//console.log(item);
	let links=[];
	const relatives=props.children?item.childrenUids:item.parentUids;
	relatives.forEach(uid => {
		const tokens=uid.split(':');
		if (tokens[0]==='task') {
			links.push(<TaskLink key={uid} id={Number(tokens[1])}/>);
		}
		if (tokens[0]==='ticket') {
			links.push(<TicketLink key={uid} id={Number(tokens[1])}/>);
		}
	});
	return links;
}
export default ParentLink;