<?php
/** Контракт самонаблюдения без подключения к порталу. */
class stages_provider { static function applyRequest($type, $id) {} }
class WatchTestHalt extends Exception {}

/** Маршрутизатор возвращает параметры и превращает HTTP-отказ в проверяемое исключение. */
class router {
	static $params = array();
	static function getRoute($number, $name, $default = null) { return array_key_exists($name, self::$params) ? self::$params[$name] : $default; }
	static function haltJson($message, $code = 500) { throw new WatchTestHalt($message, $code); }
}

/** Вошедший пользователь задаётся серверной сессией. */
class CUser { function GetID() { return 5; } }
$USER = new CUser();

/** Подставной TaskItem контролирует пользователя и вызовы штатных методов наблюдения. */
class CTaskItem {
	static $responsible = 7;
	static $creator = 8;
	static $auditors = array(9);
	static $calls = array();
	static $updates = array();
	function __construct($id, $userId) { if ($id !== 1 || $userId !== 5) throw new Exception('Неверный контекст задачи'); }
	function GetData() { return array('ID' => 1, 'RESPONSIBLE_ID' => self::$responsible, 'CREATED_BY' => self::$creator, 'VIEWED_DATE' => '', 'CREATED_DATE' => '01.10.2026'); }
	function startWatch() { self::$calls[] = 'start'; self::$auditors = array_values(array_unique(array_merge(self::$auditors, array(5)))); }
	function stopWatch() { self::$calls[] = 'stop'; self::$auditors = array_values(array_diff(self::$auditors, array(5))); }
	/** Запоминает изменения дат для проверки общего action_update на PHP 8. */
	function Update($fields) { self::$updates[] = $fields; }
}

/** Участники перечитываются после изменения наблюдения. */
class CTaskMembers {
	static function GetList($order, $filter) { return new WatchTestMembers(); }
}
class WatchTestMembers {
	private $index = 0;
	function Fetch() { return isset(CTaskItem::$auditors[$this->index]) ? array('TYPE' => 'U', 'USER_ID' => CTaskItem::$auditors[$this->index++]) : false; }
}

/** Проверка с явной ошибкой, независимая от настройки PHP assertions. */
function checkWatch($condition, $message) { if (!$condition) throw new Exception($message); }

/** Выполнить запрос и разобрать JSON-ответ. */
function callWatch($watching) {
	router::$params = array('id' => 1, 'watching' => $watching, 'userId' => 99, 'AUDITORS' => array(99));
	ob_start();
	try { $controller = new controller_task(); $controller->action_update(); $result = ob_get_contents(); }
	catch (Exception $e) { ob_end_clean(); throw $e; }
	ob_end_clean();
	return json_decode($result, true);
}

$globalTzOffset = 0;
$_SERVER['REQUEST_METHOD'] = 'POST';
require_once __DIR__ . '/../back/app/ctl/controller_task.php';
$result = callWatch(true);
checkWatch($result['id'] === 1 && CTaskItem::$auditors === array(9, 5), 'Добавление должно сохранить чужих наблюдателей');
$result = callWatch(false);
checkWatch($result['id'] === 1 && CTaskItem::$auditors === array(9), 'Снимать можно только собственное наблюдение');
checkWatch(CTaskItem::$calls === array('start', 'stop'), 'Нужны штатные методы самонаблюдения');
foreach (array('responsible', 'creator') as $role) {
	CTaskItem::${$role} = 5;
	try { callWatch(true); throw new Exception('Роль не заблокирована'); }
	catch (WatchTestHalt $e) { checkWatch($e->getCode() === 409, 'Ожидался HTTP 409'); }
	CTaskItem::${$role} = 7;
}
try { callWatch('false'); throw new Exception('Неверный параметр принят'); }
catch (WatchTestHalt $e) { checkWatch($e->getCode() === 409, 'Ожидался HTTP 409'); }
checkWatch(CTaskItem::$calls === array('start', 'stop'), 'Запрещённые запросы не должны менять роли');

// Смена срока использует тот же объект сессии и не должна вызывать GetID статически.
router::$params = array('id' => 1, 'deadline' => 1793800800, 'startDatePlan' => 1793800800);
ob_start();
try { $controller = new controller_task(); $controller->action_update(); }
catch (Exception $e) { ob_end_clean(); throw $e; }
catch (Throwable $e) { ob_end_clean(); throw $e; }
ob_end_clean();
checkWatch(CTaskItem::$updates === array(
	array('DEADLINE' => date('d.m.Y', 1793800800).' 17:00:00'),
	array('START_DATE_PLAN' => date('d.m.Y', 1793800800).' 09:00:00'),
), 'Срок и плановая дата должны сохраняться в контексте текущего пользователя');
echo "OK: самонаблюдение, роли, контекст сессии и сохранение чужих наблюдателей\n";
