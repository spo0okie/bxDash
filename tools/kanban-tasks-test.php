<?php
/** Контракт загрузки ролей канбана без портала; Bitrix заменён проверяемыми ответами API. */
class stages_provider {}

/** Минимальный курсор Bitrix для задач и участников. */
class KanbanTestResult {
	private $rows;
	function __construct($rows) { $this->rows = $rows; }
	function Fetch() { return array_shift($this->rows); }
	function GetNext() { return $this->Fetch(); }
}

/** Подставной API сохраняет фильтры и выдаёт ответы в порядке запросов. */
class CTasks {
	static $queries = array();
	static $answers = array();
	static function GetList($order, $filter) {
		self::$queries[] = $filter;
		return new KanbanTestResult(array_shift(self::$answers));
	}
	static function GetUpdatesCount($dates) { return array(); }
}

/** Роли одной задачи: ответственный не должен дублироваться среди соисполнителей. */
class CTaskMembers {
	static function GetList($order, $filter) {
		return new KanbanTestResult(array(
			array('TYPE' => 'A', 'USER_ID' => '7'),
			array('TYPE' => 'A', 'USER_ID' => '9'),
			array('TYPE' => 'U', 'USER_ID' => '5'),
		));
	}
}

/** Форматирование дат для фильтра; часовой пояс не влияет на проверку ролей. */
function ConvertTimeStamp($time, $format) { return date('d.m.Y H:i:s', $time); }

/** Явные проверки работают и при отключённых PHP assertions. */
function checkKanban($condition, $message) {
	if (!$condition) throw new Exception($message);
}

$globalTzOffset = 0;
require_once __DIR__ . '/../back/app/ctl/controller_task.php';
$task = array('ID' => '1', 'RESPONSIBLE_ID' => '7', 'CREATED_BY' => '5', 'CREATED_DATE' => '01.10.2026', 'VIEWED_DATE' => '');
$method = new ReflectionMethod('controller_task', 'loadPeriodUsers');
$method->setAccessible(true);
CTasks::$answers = array(array($task), array($task, array_merge($task, array('ID' => '2'))));
$rows = $method->invoke(null, time() - 86400, null, array('5', '8', '5', 'bad'));
checkKanban(count($rows) === 2, 'Задачи по нескольким ролям должны объединяться без дублей');
checkKanban($rows[0]['ACCOMPLICES'] === array('9'), 'Неверные соисполнители');
checkKanban($rows[0]['AUDITORS'] === array('5'), 'Не загружены наблюдатели');
checkKanban($rows[0]['CREATED_BY'] === '5', 'Потерян постановщик');
$filter = CTasks::$queries[1];
checkKanban($filter['CHECK_PERMISSIONS'] === 'Y', 'Нельзя обходить права Bitrix');
checkKanban($filter['!REAL_STATUS'] === array(5, 7), 'Контроль должен загружать только открытые задачи');
checkKanban($filter['::SUBFILTER-1'] === array(
	'::LOGIC' => 'OR',
	'::SUBFILTER-1' => array('AUDITOR' => 5),
	'::SUBFILTER-2' => array('CREATED_BY' => 5),
	'::SUBFILTER-3' => array('AUDITOR' => 8),
	'::SUBFILTER-4' => array('CREATED_BY' => 8),
), 'Роли должны охватывать всех загруженных пользователей скалярными ID');
CTasks::$queries = array();
CTasks::$answers = array(array());
$method->invoke(null, time() - 172800, time() - 86400, array('5'));
checkKanban(count(CTasks::$queries) === 1, 'Подгрузка истории не должна повторять загрузку ролевых задач');

// Регрессия нового портала: старая открытая задача ответственного без срока.
CTasks::$queries = array();
$withoutDeadline = array_merge($task, array(
	'ID' => '120577', 'RESPONSIBLE_ID' => '1229', 'CREATED_BY' => '916',
	'CREATED_DATE' => '21.08.2023 19:27:47', 'DEADLINE' => null, 'REAL_STATUS' => '2',
));
CTasks::$answers = array(array($withoutDeadline), array());
$rows = $method->invoke(null, time() - 86400, null, array('1229'));
checkKanban(count($rows) === 1 && $rows[0]['ID'] === '120577', 'Потеряна задача ответственного без срока');
$filter = CTasks::$queries[0];
checkKanban($filter['CHECK_PERMISSIONS'] === 'Y', 'Нельзя обходить права для задач ответственного');
checkKanban($filter['::SUBFILTER-1'] === array(
	'::LOGIC' => 'OR',
	'::SUBFILTER-1' => array('ACCOMPLICE' => array('1229')),
	'::SUBFILTER-2' => array('RESPONSIBLE_ID' => array('1229')),
), 'Ответственный и соисполнитель должны быть независимыми ветками OR');
checkKanban($filter['::SUBFILTER-2']['::SUBFILTER-1'] === array('!REAL_STATUS' => array(5, 7)),
	'Открытые задачи долгого ящика не должны ограничиваться сроком или датой создания');

echo "OK: загрузка наблюдателей, постановщиков и фильтров канбана\n";
