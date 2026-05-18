import React, { useEffect, useRef } from "react";
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
 *
 * Также здесь:
 *  - при скролле сохраняем timestamp верхнего/левого видимого Period в layout.currentInterval;
 *  - при смене раскладки (expand/personal) перематываем к сохранённому интервалу,
 *    чтобы юзер не терял позицию при разбиении недели на дни / схлопывании обратно.
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

	// Флаг подавляет запись в currentInterval, пока мы сами восстанавливаем скролл
	// после смены раскладки — иначе восстановленная позиция мгновенно перезатрёт оригинальную.
	const restoringRef = useRef(false);

	useEffect(() => {
		const container = document.getElementById('calendarGrid');
		if (!container) return;

		const horizontal = personal && !layout.expand;

		// Восстановление сохранённой позиции при монтировании / после смены раскладки.
		// Двойной rAF: первый ждёт реренда после смены expand, второй — после раскладки браузером.
		// Плавная прокрутка (как у "home") — таймер подавления записи должен покрывать всю анимацию.
		restoringRef.current = true;
		const scrollDuration = 1200;
		const rafRestore = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				layout.scrollToCurrentInterval(scrollDuration);
			});
		});
		const restoreClearTimer = setTimeout(() => { restoringRef.current = false; }, scrollDuration + 300);

		// Throttle через rAF: на каждый кадр не больше одного поиска видимого периода.
		let rafScroll = null;
		let lastSaved = layout.currentInterval;
		const onScroll = () => {
			if (restoringRef.current) return;
			if (rafScroll) return;
			rafScroll = requestAnimationFrame(() => {
				rafScroll = null;
				const rect = container.getBoundingClientRect();
				const today = time.today;
				const nodes = container.querySelectorAll('.Period[data-period-id]');
				let best = null;
				let bestDist = Infinity;
				for (const node of nodes) {
					const r = node.getBoundingClientRect();
					// Период считается видимым, если его прямоугольник пересекает контейнер
					// в направлении прокрутки (с допуском 1px на границах).
					const visible = horizontal
						? (r.right > rect.left + 1 && r.left < rect.right - 1)
						: (r.bottom > rect.top + 1 && r.top < rect.bottom - 1);
					if (!visible) continue;
					const id = Number(node.getAttribute('data-period-id'));
					if (!Number.isFinite(id)) continue;
					// Среди видимых периодов выбираем ближайший к "сегодня".
					const dist = today != null ? Math.abs(id - today) : 0;
					if (dist < bestDist) {
						bestDist = dist;
						best = id;
					}
				}
				if (best == null) return;
				if (best === lastSaved) return;
				lastSaved = best;
				layout.setCurrentInterval(best);
			});
		};

		container.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			container.removeEventListener('scroll', onScroll);
			cancelAnimationFrame(rafRestore);
			if (rafScroll) cancelAnimationFrame(rafScroll);
			clearTimeout(restoreClearTimer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [personal, layout.expand]);

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
