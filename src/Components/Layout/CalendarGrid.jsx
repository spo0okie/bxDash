import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "Data/Stores/StoreProvider";
import Interval from "./Interval/Interval";
import ScrollSection from "./ScrollSection/ScrollSection";
import BucketIntervals from "./BucketIntervals";

/**
 * Основная область календаря: список интервалов по weeksRange + корзина в конце.
 * Корзина показывается только в режиме "все пользователи" (personal=false);
 * в personal-режиме корзина живёт в правой панели (см. RightPaneBucket).
 *
 * id="calendarGrid" — критичен: на него завязан LayoutStore.scrollTo через react-scroll.
 */
const CalendarGrid = observer(() => {
	const { time, users, layout } = useStores();
	const personal = users.selected !== null;

	// Хитрый расчёт ширины компенсирует абсолютно-позиционированную правую панель
	// в personal+columns-режиме. Не "переписывать на flex" без полного аудита CSS.
	const style = (personal && !layout.expand) ? {
		width: (layout.windowDimensions.width
			- (layout.useSplitBucket ? 450 : 200)
			- (layout.memosVisible ? layout.sidebarWidth : 0)
		) + 'px'
	} : null;

	return (
		<ScrollSection
			className={classNames("Calendar", { 'ColumnScroller': personal && !layout.expand })}
			id='calendarGrid'
			style={style}
		>
			{time.weeksRange(false).map(i => <Interval key={i} id={i} />)}
			{!personal && <BucketIntervals />}
		</ScrollSection>
	);
});

export default CalendarGrid;
