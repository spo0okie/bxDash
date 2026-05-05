import 'reflect-metadata';
import { observable, values, set, has, get, keys, remove, action, makeObservable, observe } from 'mobx';
import IntervalItem from './IntervalItem';

/**
 * Хранилище недельных интервалов и периодов.
 * После Этапа 8 интервалы и периоды НЕ владеют элементами через двусторонние ссылки —
 * они только хранят свои границы. Элементы фильтруются периодами декларативно
 * через PeriodItem._pick (зависит от items[type].items напрямую).
 */
class PeriodsStore {
    intervals = observable.map();   //недельные интервалы
    periods = observable.map();     //периоды (дни или недели в зависимости от layout.expand)

    main;
    layout;
    time;
    items;       //ссылка на ItemsMultiStore (устанавливается через attachItemsStore)
    expand;

    /**
     * Пере-/со-здаёт недельные интервалы по time.weeksRange().
     * Лишние интервалы удаляются, новые создаются.
     */
    weeksInit() {
        const weeks = this.time.weeksRange(true);

        // обновить существующие, создать недостающие
        weeks.reverse().forEach(id => {
            if (has(this.intervals, id)) {
                get(this.intervals, id).init();
            } else {
                set(this.intervals, id, new IntervalItem(id, this.main, this.time, this.layout, this));
            }
        });

        // удалить лишние
        keys(this.intervals).forEach(id => {
            if (!weeks.includes(id)) this.deleteInterval(id);
        });
    }

    setPeriod(period) {
        set(this.periods, period.start, period);
    }

    deletePeriod(id) {
        remove(this.periods, id);
    }

    /** Удалить интервал: освободить его периоды и убрать из карты. */
    deleteInterval(id) {
        get(this.intervals, id).destroy();
        remove(this.intervals, id);
    }

    /** Привязать корневое хранилище элементов — оно используется в PeriodItem._pick. */
    attachItemsStore(items) {
        this.items = items;
    }

    constructor(main, layout, time) {
        this.main = main;
        this.layout = layout;
        this.time = time;

        makeObservable(this, {
            intervals: observable,
            periods: observable,
            weeksInit: action,
            setPeriod: action,
            deletePeriod: action,
            deleteInterval: action,
        });

        this.weeksInit();

        // При смене границ диапазона недель — пересобираем интервалы.
        observe(time, 'weekMin', () => this.weeksInit());
        observe(time, 'weekMax', () => this.weeksInit());
        // При смене "сегодня" — границы недель могли поплыть (вс->пн), пересобираем.
        // Элементы перепривяжутся сами через computed (зависит от item.t и period.start/end).
        observe(time, 'today', () => this.weeksInit());
    }

    /** Используется только для отладки. */
    logStatus() {
        values(this.intervals).forEach(item => item.logInfo());
    }
}

export default PeriodsStore;
