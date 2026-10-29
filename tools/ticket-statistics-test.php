<?php
require_once __DIR__ . '/../back/app/models/ticket_statistics_rules.php';
require_once __DIR__ . '/../back/app/models/ticket_statistics.php';
require_once __DIR__ . '/../back/app/models/ticket_hold_intervals.php';

/** Пользователи тестового портала. */
class CUser {
	static public function GetUserGroup($id) { return $id == 6 ? [6] : []; }
}

/** Минимальный курсор результата Bitrix. */
class test_result {
	private $rows;
	public function __construct($rows) { $this->rows = $rows; }
	public function Fetch() { return array_shift($this->rows); }
}

/** Эмулируем старый Bitrix: числовые фильтры приводятся к int, строка «1|2» даёт только 1. */
class CTicket {
	static public $filters = [];
	static public $rows = [];
	static public $historyIds = [];
	static public function GetList(&$by, &$order, $filter, &$isFiltered, $rights) {
		self::$filters[] = $filter;
		$rows = [];
		foreach (self::$rows as $row) {
			if ((int)$row['RESPONSIBLE_USER_ID'] !== (int)$filter['RESPONSIBLE_ID']) continue;
			if (isset($filter['STATUS_ID']) && (int)$row['STATUS_ID'] !== (int)$filter['STATUS_ID']) continue;
			if (isset($filter['DATE_CLOSE_1']) && !$row['DATE_CLOSE']) continue;
			$rows[] = $row;
		}
		return new test_result($rows);
	}
	static public function GetMessageList(&$by, &$order, $filter, &$isFiltered, $rights) {
		self::$historyIds[] = $filter['TICKET_ID'];
		return new test_result([]);
	}
}

/** Строка заявки с достаточными полями отчёта. */
function ticketRow($id, $user, $title = 'Рабочая заявка') {
	return ['ID' => $id, 'TITLE' => $title, 'RESPONSIBLE_USER_ID' => $user, 'RESPONSIBLE_NAME' => 'Сотрудник',
		'CATEGORY_ID' => 1, 'STATUS_ID' => 9, 'CREATED_USER_ID' => 1, 'OWNER_USER_ID' => 1,
		'HOLD_ON' => 'N', 'LAST_MESSAGE_BY_SUPPORT_TEAM' => 'Y', 'DATE_CREATE' => '01.09.2026 12:00:00',
		'DATE_CLOSE' => '', 'LAST_MESSAGE_DATE' => '15.09.2026 12:00:00'];
}

/** Проверка условия с понятной причиной. */
function verify($condition, $message) {
	if (!$condition) throw new Exception($message);
}

$rules = ticket_statistics_rules::get();
verify($rules['overdueDays'] === 2, 'Порог просрочки соответствует SLA организации: 2 рабочих дня');
verify(ticket_statistics::exclusion(ticketRow(1, 1, 'Тестирование сервера'), $rules) === null, 'Тестирование не TEST');
verify(ticket_statistics::exclusion(ticketRow(1, 1, 'latest version'), $rules) === null, 'latest не TEST');
verify(ticket_statistics::exclusion(ticketRow(1, 1, '[ТЕСТ] заявка'), $rules) === 'Тестовая заявка', 'Точный маркер ТЕСТ');
verify(ticket_statistics::exclusion(ticketRow($rules['excludedIds'][0], 1), $rules) === 'Ручной список исключений отчёта', 'Ручной список');
$internal = ticketRow(1, 1);
$internal['CREATED_USER_ID'] = 6;
$internal['OWNER_USER_ID'] = 6;
verify(ticket_statistics::exclusion($internal, $rules) === 'Заявка от техподдержки', 'Внутренние заявки');
$closed = ticketRow(1, 1);
$closed['STATUS_ID'] = 1;
$closed['DATE_CLOSE'] = '16.09.2026 12:00:00';
verify(ticket_statistics::closeDate($closed, $rules) === $closed['DATE_CLOSE'], 'Штатное закрытие независимо от статуса');
$held = ticketRow(1, 1);
$held['HOLD_ON'] = 'Y';
verify(ticket_statistics::closeDate($held, $rules) === null, 'Отложенная заявка не решена');
$secondStatus = ticketRow(4, 2);
$secondStatus['STATUS_ID'] = 10;
CTicket::$rows = [ticketRow(1, 1), ticketRow(2, 99), ticketRow(3, 2, 'TEST'), $secondStatus];
$rows = ticket_statistics::load('01.09.2026 00:00:00', '30.09.2026 23:59:59', 'created', $rules, [1, 2]);
verify(count($rows) === 3, 'Получены заявки обоих сотрудников, посторонний исключён');
verify((int)$rows[2]['RESPONSIBLE_USER_ID'] === 2, 'Получена рабочая заявка второго сотрудника');
foreach (CTicket::$filters as $filter) verify(is_int($filter['RESPONSIBLE_ID']), 'В Bitrix передаётся один числовой ID ответственного');
verify(!isset(CTicket::$filters[0]['SLA_ID']), 'Направления не ограничивают отчёт');
verify(CTicket::$historyIds === [1, 4], 'История обоих сотрудников загружена, исключённых — нет');
CTicket::$historyIds = [];
$rows = ticket_statistics::load('01.09.2026 00:00:00', '30.09.2026 23:59:59', 'closed', $rules, [1, 2]);
verify(count($rows) === 3 && CTicket::$historyIds === [1, 4], 'Оба статуса решений и оба сотрудника попадают в отчёт');
foreach (CTicket::$filters as $filter) {
	if (isset($filter['STATUS_ID'])) verify(is_int($filter['STATUS_ID']), 'Статус решения также передаётся одним числовым ID');
}
CTicket::$rows = [ticketRow(1, 1)];
$rows = ticket_statistics::load('01.10.2026 00:00:00', '31.10.2026 23:59:59', 'closed', $rules, [1]);
verify(count($rows) === 0, 'Решение вне периода исключено');
echo "OK: статистика загруженных сотрудников\n";
