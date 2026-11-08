<?php
/** Контракт создания связей через высокоуровневое API Bitrix без портала. */
class stages_provider {}
class TaskLinkHalt extends Exception {}
/** Параметры запроса и HTTP-ошибки. */
class router {
	static $params;
	static function getRoute($index, $name) { return isset(self::$params[$name]) ? self::$params[$name] : null; }
	static function haltJson($message, $code) { throw new TaskLinkHalt($message, $code); }
}
/** Курсор Bitrix. */
class TaskLinkResult {
	private $rows;
	function __construct($rows) { $this->rows = $rows; }
	function Fetch() { return array_shift($this->rows); }
}
/** Видимость обеих задач проверяется с правами текущей сессии. */
class CTasks {
	static $visible = array(array('ID' => 1), array('ID' => 2));
	static function GetList($order, $filter, $select) {
		if ($filter['CHECK_PERMISSIONS'] !== 'Y') throw new Exception('Нет проверки прав');
		return new TaskLinkResult(self::$visible);
	}
}
/** Граф предыдущих задач для проверки циклов. */
class CTaskDependence {
	static $links = array();
	static function GetList($order, $filter) {
		$rows = array();
		foreach (self::$links as $link) if ($link['TASK_ID'] == $filter['TASK_ID']) $rows[] = $link;
		return new TaskLinkResult($rows);
	}
}
/** Запись обязательно идёт от имени пользователя и сохраняет предыдущие зависимости. */
class CTaskItem {
	static $writes = array();
	static $parents = array();
	static $deny = false;
	private $id;
	function __construct($id, $user) { if ($user !== 5) throw new Exception('Неверная сессия'); $this->id = $id; }
	function GetData() { return array('PARENT_ID' => isset(self::$parents[$this->id]) ? self::$parents[$this->id] : 0); }
	function getDependsOn() { return array(9); }
	function Update($fields) {
		if (self::$deny) throw new Exception('Нет прав на изменение');
		self::$writes[] = array($this->id, $fields);
		return true;
	}
}
/** Текущий пользователь берётся только из серверной сессии. */
class CUser { function GetID() { return 5; } }
$USER = new CUser();
require_once __DIR__ . '/../back/app/ctl/controller_task.php';

/** Выполняет запрос и сверяет изменения или ожидаемый отказ. */
function checkTaskLink($relation, $expected, $error = false) {
	router::$params = array('id' => 1, 'targetId' => 2, 'relation' => $relation);
	CTaskItem::$writes = array();
	ob_start();
	try {
		$controller = new controller_task();
		$controller->action_link();
		if ($error) throw new Exception('Ожидался отказ');
	} catch (TaskLinkHalt $e) {
		if (!$error || $e->getCode() !== 409) throw $e;
	} finally { ob_end_clean(); }
	if (CTaskItem::$writes !== $expected) throw new Exception('Неверная запись: ' . json_encode(CTaskItem::$writes));
}
checkTaskLink('subtask', array(array(1, array('PARENT_ID' => 2))));
checkTaskLink('next', array(array(2, array('DEPENDS_ON' => array(9, 1)))));
checkTaskLink('previous', array(array(1, array('DEPENDS_ON' => array(9, 2)))));
checkTaskLink('invalid', array(), true);
CTaskDependence::$links = array(array('TASK_ID' => 1, 'DEPENDS_ON_ID' => 3), array('TASK_ID' => 3, 'DEPENDS_ON_ID' => 2));
checkTaskLink('next', array(), true);
CTaskItem::$parents = array(2 => 3, 3 => 1);
checkTaskLink('subtask', array(), true);
CTasks::$visible = array(array('ID' => 1));
checkTaskLink('previous', array(), true);
CTasks::$visible[] = array('ID' => 2);
CTaskItem::$deny = true;
checkTaskLink('previous', array(), true);
echo "OK: task linking\n";
