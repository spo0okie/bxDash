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

	/**
	 * Переместить элемент с индексом index в позицию между after и before
	 * @param {*} array 
	 * @param {*} index 
	 * @param {*} after 
	 * @param {*} before 
	 * @returns 
	 */
	moveItem(array,index,after,before) {
		console.log(array);
		console.log(index,after,before);

		let newArr=[];	
		let moving=array[index];

		array.splice(index,1);
		if (index<before) before--;
		if (index<after) after--;

		console.log(array);
		console.log(after,before);

		if (typeof after === 'number') {
			for (let i=0;i<=after; i++) {
				console.log(i);
				newArr.push(array[i]);
			}
		}

		newArr.push(moving);
		console.log('!');

		if (typeof before === 'number') {
			for (let i=before;i<array.length; i++) {
				console.log(i);
				newArr.push(array[i]);
			}
		}

		console.log(newArr);
		return newArr;
	}
}

export default ArrayHelper = new ArrayHelper();