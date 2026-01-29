

/**
 * Возвращает индекс сортировки закрытого элемента
 * @param item
 */
function dashClosedItemSortIndex(item) {
	if (item.type === 'plan') return 120;
	if (item.type === 'task') return 100;
    if (item.type==='ticket') return 80;
    if (item.type==='job') return 60;
    return 0;
}

/**
 * Сортировка закрытых элементов (такая логика годится только для закрытых)
 * Давайте попробуем придерживаться такой логики:
 * Сначала задачи, потом тикеты, потом работы
 * Элемент без даты идет позже элемента с датой
 */
export function dashClosedItemsSort(a,b) {
    let sortingA=dashClosedItemSortIndex(a);
    let sortingB=dashClosedItemSortIndex(b);
    if (sortingA===sortingB) {
		if (a.id === b.id) return 0;
		return a.id < b.id ? 1 : -1;
        //return canBanSortItemsByDate(b,a);
    }
    //console.log(sortingA+" vs "+sortingB);
    return (sortingA > sortingB) ? 1:-1;
}

//Сравнение элементов по индексу сортировки
export function dashItemsSort(a,b) {
	//console.log(typeof a.sorting + a.sorting);
	//console.log(typeof b.sorting + b.sorting);
	if (a.type === 'ticket' && b.type === 'ticket') {
		if (a.id === b.id) return 0;
		return a.id < b.id ? 1 : -1;
	}

	if (a.type === 'ticket' || b.type === 'ticket') {
		return a.type === 'ticket' ? 1 : -1;
	}

    if (a.sorting===b.sorting) {
        //по индексу одинаковые - сравним по времени
        if (a.t === b.t) {
            //по времени одинаковые - сравним по ID
            if (a.id === b.id) return 0;
            return a.id < b.id? 1 : -1;
        }
        if (b.t === null) return 1; //У B нет даты, потому он "позже"
        if (a.t === null) return -1; //У A нет даты, потому он "позже"
        return (a.t < b.t)? 1: -1;
    };
    return (a.sorting>b.sorting)? 1 : -1;
}

