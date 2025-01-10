class ArrayHelper {
	/**
	 * Добавляет в массив уникальный элемент (не уникальный не добавляет)
	 * @param {array} array 
	 * @param {*} item 
	 */
	addUniq(array,item) {
		if (array.includes(item)) return;
		if (array.find(value=>value.uid===item.uid)) return;
		array.push(item);
	}

	/**
	 * Удаляет из массива переданный элемент
	 * @param {array} array 
	 * @param {*} item 
	 */
	delUidItem(array,item) {
		let index=array.findIndex(value=>value.uid===item.uid);
		if (index<0) {
			console.log(item.uid+' not founf');
			return;
		}
		array.splice(index,1)		
	}
}

export default ArrayHelper = new ArrayHelper();