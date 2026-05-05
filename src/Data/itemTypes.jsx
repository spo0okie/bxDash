import TaskItem from 'Data/Models/TaskItem';
import JobItem from 'Data/Models/JobItem';
import PlanItem from 'Data/Models/PlanItem';
import TicketItem from 'Data/Models/TicketItem';
import MemoItem from 'Data/Models/MemoItem';
import AbsentItem from 'Data/Models/AbsentItem';
import DashItem from 'Data/Models/DashItem';

/**
 * Реестр типов элементов dashboard — единая точка описания.
 *
 * Поля:
 *   class      — конструктор модели
 *   reloadMs   — период авто-перезагрузки с бэка (0 — не перезагружать по таймеру)
 *   wsEvent    — имя WebSocket-события на обновление (null — этот тип не приходит по WS)
 *   wsIdField  — имя поля с id внутри WS-сообщения (у task — taskId, у plan — id и т.д.)
 *
 * Все циклы по типам в проекте должны строиться от этого объекта,
 * а не от литеральных списков [task, ticket, job, ...].
 */
export const ITEM_TYPES = {
	task:   { class: TaskItem,   reloadMs: 5 * 60 * 1000, wsEvent: 'taskUpdate',   wsIdField: 'taskId'   },
	ticket: { class: TicketItem, reloadMs: 2 * 60 * 1000, wsEvent: 'ticketUpdate', wsIdField: 'ticketId' },
	job:    { class: JobItem,    reloadMs: 0,             wsEvent: 'jobUpdate',    wsIdField: 'jobId'    },
	plan:   { class: PlanItem,   reloadMs: 0,             wsEvent: 'planUpdate',   wsIdField: 'id'       },
	memo:   { class: MemoItem,   reloadMs: 0,             wsEvent: null,           wsIdField: null       },
	absent: { class: AbsentItem, reloadMs: 0,             wsEvent: null,           wsIdField: null       },
};

/** Имена всех зарегистрированных типов в порядке объявления. */
export const ITEM_TYPE_NAMES = Object.keys(ITEM_TYPES);

/** Базовый класс для типа 'dash' — fallback, если конкретный класс не найден. */
export const DASH_BASE_CLASS = DashItem;

/**
 * Вернуть класс модели для указанного типа.
 * Для 'dash' (или неизвестного) — возвращает DashItem.
 */
export function classForType(type) {
	return ITEM_TYPES[type]?.class ?? DASH_BASE_CLASS;
}
