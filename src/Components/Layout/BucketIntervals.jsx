import React from "react";
import { observer } from "mobx-react";
import { useStores } from "Data/Stores/StoreProvider";
import Interval from "./Interval/Interval";

/**
 * Корзина (долгий ящик) — рендерит один или три Interval'а в зависимости от useSplitBucket.
 * Используется и в основной области (CalendarGrid), и в правой панели (RightPaneBucket).
 *
 * Все три псевдо-интервала имеют ОДИН id (time.weekMax + 1), но разный priority.
 * Сейчас фильтрация по priority выполняется в Period/Data — см. план, этап 8.
 */
const BucketIntervals = observer(() => {
	const { time, layout } = useStores();
	const bucketId = time.weekMax + 1;

	if (!layout.useSplitBucket) {
		return <Interval key={bucketId} id={bucketId} />;
	}
	return (
		<>
			{[2, 1, 0].map(p => (
				<Interval key={bucketId + '-' + p} id={bucketId} priority={p} />
			))}
		</>
	);
});

export default BucketIntervals;
