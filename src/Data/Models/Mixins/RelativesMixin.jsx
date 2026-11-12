import ArrayHelper from "Helpers/ArrayHelper"
import {when} from 'mobx';

const RelativesMixin = {
	addParent(item) {
		//console.log(this);
		ArrayHelper.addUniq(this.parents,item);
	},

	addChild(item) {
		//console.log(this);
		ArrayHelper.addUniq(this.children,item);
	},

	removeParent(item) {
		ArrayHelper.delUidItem(this.parents,item)
	},

	removeChild(item) {
		ArrayHelper.delUidItem(this.children,item)
	},

	/**
	 * Проверяет, у элемента this ссылки на объект item, если этот элемент премок или потомок item, 
	 * то строит ссылки в обе стороны
	 * @param {*} item 
	 */
	reverseLinksCheck(item) {
		if (this.parentUids.includes(item.uid)) {
			this.addParent(item);	
			item.addChild(this);
		}

		if (this.childUids.includes(item.uid)) {
			this.addChild(item);	
			item.addParent(this);
		}
	},

	/**
	 * Удаляет ссылки на себя из объектов на которые ссылается сам.
	 */
	detachLinks() {
		this.parents.forEach(item=>item.removeChild(this))
		this.parents=[];
		this.children.forEach(item=>item.removeParent(this))
		this.children=[];
	},

	/** Перестраивает связи по текущим UID элемента и его прежних соседей. */
	directLinksRebuild() {
		const relatives = new Set([...this.parents, ...this.children]);
		this.detachLinks();
		const master = this.list?.master;
		if (typeof master?.requestRelated === 'function') {
			master.requestRelated(this, [...this.parentUids, ...this.childUids]);
		}
		// Например, связь подзадачи с родителем приходит только в данных подзадачи.
		for (const relative of relatives) relative.reverseLinksCheck(this);
	},

	parseTicketReplace(match) {return '';},

	parseTaskReplace(match) {return '';},

	/**
	 * Вытащить ссылки из текста заголовка, построить заголовок без ссылок в тексте (для ссылок в виде taskLinks)
	 */
	parseTitle() {
		const uids=this.titleLinks;
		const title=this.linksAttr;

		this[uids]=[];
		this.parsedTitle=this[title];

		//taskRe = /задача\s*[#№]?\s*:?\s*(\d+)/i;
		const tasksRe = /(работ[аы] по задаче|задача)\s*[#№]?\s*[:-]?\s*(\d+)/ig;
		//ticketRe = /(тикет|заявка|обращение)\s*[#№]?\s*:?\s*(\d+)/i;
		const ticketsRe = /(тикет|заявка|обращение)\s*[#№]?\s*[:-]?\s*(\d+)/ig;
	
		const taskMatch = [...this.parsedTitle.matchAll(tasksRe)];
		if (Array.isArray(taskMatch) && taskMatch.length) {
			taskMatch.forEach(match=>{
				//this.taskId = ;
				this[uids].push('task:' + Number(match[2]));
				this.parsedTitle=this.parsedTitle.replace(match[0],this.parseTaskReplace(match));
			})
		}

		const ticketMatch = [...this.parsedTitle.matchAll(ticketsRe)];
		if (Array.isArray(ticketMatch) && ticketMatch.length) {
			ticketMatch.forEach(match=>{
				this[uids].push('ticket:' + Number(match[2]));
				this.parsedTitle=this.parsedTitle.replace(match[0],this.parseTicketReplace(match));
			})
		}

		this.directLinksRebuild();
	},

	/**
	 * Убирает повтор заголовка связанного элемента, а для одной ссылки подставляет его текст.
	 * @returns 
	 */
	cleanTitle() {
		let title=this.parsedTitle

		// Ссылки из текста сохраняются при обновлении задачи, даже если её обратные связи перестроены.
		const links=this.list.master.getUidsItems(this[this.titleLinks]);

		if (!links.length) return title;

		links.forEach(link=>{
			title=title.replace(link.title,'')
			//console.log(this.parsedTitle);
		})
		
		//если после уборки не осталось вообще ничего - добавляем текст задачи
		if (!title.trim().length || title.trim()===':') title+=links[0].title;

		return title;
	}

	
}

export default RelativesMixin;
