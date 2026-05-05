import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "Data/Stores/StoreProvider";
import BucketIntervals from "./BucketIntervals";

/**
 * Правая панель с корзиной — отображается только в personal-режиме (выбран один пользователь).
 * Класс x3 на контейнере используется CSS-сеткой при включённом split-режиме.
 */
const RightPaneBucket = observer(() => {
	const { layout } = useStores();
	return (
		<div className={classNames("rightPane", { 'x3': layout.useSplitBucket })}>
			<BucketIntervals />
		</div>
	);
});

export default RightPaneBucket;
