import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreContext } from '../src/Data/Stores/StoreProvider';
import ScheduleStore from '../src/Data/Stores/ScheduleStore';
import ModalWindow from '../src/Components/Layout/Modal/ModalWindow';
import { TicketStatisticsButton } from '../src/Components/Layout/TicketStatistics/TicketStatistics';

const FIXTURE = {
	asOf: '12.10.2026 12:00:00', periodEnd: '30.09.2026 23:59:59', overdueDays: 2,
	rows: [
		{ ID: 101, TITLE: 'Настройка почты', RESPONSIBLE_USER_ID: 1, DATE_CREATE: '07.09.2026 12:00:00', REPORT_CLOSE_DATE: '08.09.2026 12:00:00', HOLD_INTERVALS: [] },
		{ ID: 102, TITLE: 'Обновление сервера', RESPONSIBLE_USER_ID: 1, DATE_CREATE: '07.09.2026 12:00:00', REPORT_CLOSE_DATE: '14.09.2026 12:00:00',
			HOLD_INTERVALS: [{ START: '09.09.2026 12:00:00', END: '11.09.2026 12:00:00' }] },
		{ ID: 103, TITLE: 'Доступ к базе', RESPONSIBLE_USER_ID: 2, DATE_CREATE: '01.09.2026 12:00:00', REPORT_CLOSE_DATE: null, HOLD_INTERVALS: [] },
		{ ID: 104, TITLE: 'Ожидание оборудования', RESPONSIBLE_USER_ID: 2, DATE_CREATE: '15.09.2026 12:00:00', REPORT_CLOSE_DATE: null,
			HOLD_INTERVALS: [{ START: '16.09.2026 12:00:00', END: null }] },
		{ ID: 105, TITLE: 'ТЕСТ — проверка', RESPONSIBLE_USER_ID: 1, DATE_CREATE: '01.09.2026 12:00:00', REPORT_CLOSE_DATE: null,
			HOLD_INTERVALS: [], EXCLUSION_REASON: 'Тестовая заявка' },
	],
};

/** Изолированная проверка реального модального компонента без авторизации и запросов к порталу. */
function Preview() {
	const [modal, setModal] = useState(null);
	const [schedule] = useState(() => new ScheduleStore({}, 0));
	const stores = {
		main: { bx: { authStatus: 'OK', fetch: async () => ({ ok: true, text: async () => JSON.stringify(FIXTURE) }) } },
		users: { order: [1, 2, 3], items: new Map([[1, { title: 'Иванов И. И.' }], [2, { title: 'Петров П. П.' }], [3, { title: 'Сидоров С. С.' }]]) },
		layout: { modal, modalVisible: Boolean(modal), setModal }, schedule,
	};
	return <StoreContext.Provider value={stores}>
		<p>Проверка UI статистики на тестовых данных. Открыть отчёт: 📊 справа вверху.</p>
		<TicketStatisticsButton /><ModalWindow />
	</StoreContext.Provider>;
}

createRoot(document.getElementById('root')).render(<Preview />);
