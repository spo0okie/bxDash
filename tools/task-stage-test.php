<?php
/** Контракт переноса задачи в канбане без подключения к порталу. */
class TaskStageTestHalt extends Exception {}

/** Пользователь текущей сессии. */
class TaskStageTestUser {
	function GetID() { return 5; }
}

/** Подставной маршрутизатор хранит параметры одного запроса. */
class router {
	static $params = [];
	static function getRoute($number, $name, $default = null) {
		return array_key_exists($name, self::$params) ? self::$params[$name] : $default;
	}
	static function haltJson($message, $code = 500) { throw new TaskStageTestHalt($message, $code); }
}

/** Эмулирует проверку видимости задачи в текущей сессии. */
class CTasks {
	static $visible = true;
	static function GetList($order, $filter, $select) {
		checkTaskStage($filter === ['ID' => 10, 'CHECK_PERMISSIONS' => 'Y'], 'Ожидалась проверка доступа на чтение');
		return new self();
	}
	function Fetch() { return self::$visible ? ['ID' => 10] : false; }
}

/** Различает право просмотра и право записи XML_ID. */
class CTaskItem {
	const ACTION_EDIT = 1;
	static $editable = false;
	static $updates = [];
	function __construct($id, $userId) {}
	function GetData() { return ['ID' => 10]; }
	function isActionAllowed($action) { return $action === self::ACTION_EDIT && self::$editable; }
	function Update($fields) {
		if (!self::$editable) throw new Exception('Задача недоступна для редактирования');
		self::$updates[] = $fields;
	}
}

/** Фиксирует запрос на запись внешней привязки. */
class stages_provider {
	static $moves = [];
	static function requested() { return array_key_exists('stage', router::$params); }
	static function applyRequest($type, $id) {
		if (self::requested()) self::$moves[] = [$type, $id, router::$params['stageUser'], router::$params['stage']];
	}
}

/** Проверяет результат независимо от настройки PHP assertions. */
function checkTaskStage($condition, $message) {
	if (!$condition) throw new Exception($message);
}

/** Вызывает тот же обработчик, что и перетаскивание карточки. */
function updateTaskStage(array $params) {
	router::$params = ['id' => 10] + $params;
	ob_start();
	try {
		$controller = new controller_task();
		$controller->action_update();
		return json_decode(ob_get_contents(), true);
	} finally {
		ob_end_clean();
	}
}

$USER = new TaskStageTestUser();
require __DIR__ . '/../back/app/ctl/controller_task.php';

// Перетаскивание передаёт sorting, а перенос из меню может сбросить стадию без sorting.
checkTaskStage(updateTaskStage(['stage' => 2, 'stageUser' => 5, 'sorting' => 480])['result'] === 'ok', 'Ожидался успешный перенос');
updateTaskStage(['stage' => null, 'stageUser' => 5]);
checkTaskStage(stages_provider::$moves === [['task', 10, 5, 2], ['task', 10, 5, null]], 'Привязка должна сохраняться без права редактирования');
checkTaskStage(CTaskItem::$updates === [], 'Перенос задачи для просмотра не должен писать XML_ID');

try {
	updateTaskStage(['sorting' => 480]);
	throw new LogicException('Сортировка без переноса должна требовать право редактирования');
} catch (Exception $e) {
	checkTaskStage($e->getMessage() === 'Задача недоступна для редактирования', 'Ожидался отказ Bitrix при записи XML_ID');
}

CTaskItem::$editable = true;
updateTaskStage(['stage' => 3, 'stageUser' => 5, 'sorting' => 500]);
updateTaskStage(['sorting' => 520]);
checkTaskStage(CTaskItem::$updates === [['XML_ID' => 500], ['XML_ID' => 520]], 'При наличии права порядок должен сохраняться');

CTasks::$visible = false;
try {
	updateTaskStage(['stage' => 2, 'stageUser' => 5, 'sorting' => 480]);
	throw new Exception('Перенос скрытой задачи прошёл');
} catch (TaskStageTestHalt $e) {
	checkTaskStage($e->getCode() === 409, 'Ожидался HTTP 409 для недоступной задачи');
}
checkTaskStage(count(stages_provider::$moves) === 3 && count(CTaskItem::$updates) === 2, 'Отказ не должен менять привязку или порядок');

echo "OK: перенос задачи, права просмотра и сохранение порядка\n";
