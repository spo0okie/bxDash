import 'reflect-metadata';
import { observable, values, set, has, get, keys, remove, action, makeObservable, observe } from 'mobx';
import IntervalItem from './IntervalItem';

/**
 * Хранилище периодов (интервалов/недель)
 * Управляет недельными интервалами и периодами в dashboard
 */
class PeriodsStore {
    // Observable свойства - реактивные данные
    intervals = observable.map();   // карты недельных интервалов
    periods = observable.map();     // карты периодов

    // Свойства-ссылки - НЕ observable (внешние зависимости)
    main;
    layout;
    time;
    items;
    expand; // внутреннее состояние expand под который построены периоды

    /**
     * Инициализация недельных интервалов
     * Создаёт, обновляет и удаляет интервалы на основе time.weeksRange()
     */
    weeksInit() {
        console.log('=== weeksInit start ===');
        console.log(`time.today=${this.time.today} (${new Date(this.time.today).toISOString()})`);
        console.log(`time.monday0=${this.time.monday0} (${new Date(this.time.monday0).toISOString()})`);
        console.log(`time.sunday0=${this.time.sunday0} (${new Date(this.time.sunday0).toISOString()})`);
        console.log(`time.weekMin=${this.time.weekMin}, time.weekMax=${this.time.weekMax}`);

        const weeks = this.time.weeksRange(true);
        console.log(`weeksRange=${JSON.stringify(weeks)}`);

        // ищем что нужно добавить
        weeks.reverse().forEach(id => {
            if (has(this.intervals, id)) {
                // если такой элемент есть - обновляем его поля (поштучно)
                //console.log(id +' updatin');
                get(this.intervals, id).init();
            } else {
                //console.log(id +' creatin');
                set(this.intervals, id, new IntervalItem(id, this.main, this.time, this.items, this.layout, this));
            }
        });

        // проверяем что нужно удалить
        keys(this.intervals).forEach(id => {
            if (!weeks.includes(id)) {
                this.deleteInterval(id)
            }
        })

        // Логирование всех интервалов и периодов
        console.log('=== Intervals and Periods ===');
        values(this.intervals).forEach(interval => {
            interval.logInfo();
            // Логирование периодов этого интервала
            interval.periodsIds.forEach(periodStart => {
                const period = get(this.periods, periodStart);
                if (period) {
                    period.logInfo();
                }
            });
        });
        console.log('=== weeksInit end ===');
        //this.logStatus();
    }

    /**
     * Перепривязка всех элементов к интервалам
     * Вызывается при изменении today
     */
    reintervalAllItems() {
        if (!this.items) return;
        this.items.types.forEach(type => {
            values(this.items[type].items).forEach(item => {
                item.findInterval();
            });
        });
    }

    /**
     * Логирование статуса хранилища
     */
    logStatus() {
        let status = {};
        values(this.intervals).forEach(item => {
            status[item.id] = item.countItems();
        })
        console.log(status);
    }

    /**
     * Установка периода в хранилище
     * @param {Object} period - объект периода со свойством start
     */
    setPeriod(period) {
        set(this.periods, period.start, period);
    }

    /**
     * Удаление периода по id
     * @param {string} id - идентификатор периода
     */
    deletePeriod(id) {
        remove(this.periods, id);
    }

    /**
     * Удаление интервала по id с очисткой
     * @param {string} id - идентификатор интервала
     */
    deleteInterval(id) {
        console.log(id + ' deletin');
        get(this.intervals, id).beforeDelete();
        remove(this.intervals, id);
    }

    /**
     * Привязка хранилища элементов к интервалам
     * @param {Object} items - хранилище элементов ItemsStore
     */
    attachItemsStore(items) {
        this.items = items;
        values(this.intervals).forEach(interval => interval.attachItemsStore(items));
    }

    /**
     * Конструктор хранилища периодов
     * @param {MainStore} main - главное хранилище
     * @param {LayoutStore} layout - хранилище layout
     * @param {TimeStore} time - хранилище времени
     */
    constructor(main, layout, time) {
        console.log('periodStore init');
        this.main = main;
        this.layout = layout;
        this.time = time;

        // Явное объявление реактивных свойств и действий
        makeObservable(this, {
            // Observable свойства
            intervals: observable,
            periods: observable,
            // Actions - методы, изменяющие observable свойства
            weeksInit: action,
            setPeriod: action,
            deletePeriod: action,
            deleteInterval: action,
        });

        // Инициализация интервалов
        this.weeksInit()

        // Подписка на изменения времени
        observe(time, 'weekMin', change => { this.weeksInit() });
        observe(time, 'weekMax', change => { this.weeksInit() });
        observe(time, 'today', change => {
            this.weeksInit();
            this.reintervalAllItems();
        });
    }

}

export default PeriodsStore;
