<?php
/** Проверяет маршрутизацию инфоблоков без портала: php tools/iblocks-test.php [custom|invalid]. */
class IblockTestHalt extends Exception {}
/** Минимальный маршрутизатор для вызова контроллеров без HTTP. */
class router {
	static $params = array();
	static function getRoute($number, $name, $default = null) {
		return isset(self::$params[$name]) ? self::$params[$name] : $default;
	}
	static function haltJson($message, $code = 500) { throw new IblockTestHalt($message, $code); }
}
/** Канбан не участвует в проверке инфоблоков. */
class stages_provider {
	static function attached($type, $items) { return $items; }
	static function requested() { return false; }
	static function applyRequest($type, $id) {}
}
/** Пустая выборка карточек и отдельная проверка принадлежности элемента. */
class IblockTestRows {
	function GetNextElement() { return false; }
	function Fetch() { return CIBlockElement::$belongs ? array('ID' => 1001) : false; }
}
/** Запоминает аргументы API Bitrix для проверок чтения и записи. */
class CIBlockElement {
	static $belongs = true;
	static $writes = 0;
	static $filter;
	static $data;
	static $propertyIblock;
	static function GetList($sort, $filter, $group, $nav, $select) {
		self::$filter = $filter;
		return new IblockTestRows();
	}
	function Add($data) { self::$writes++; self::$data = $data; return 1001; }
	function Update($id, $data) { self::$writes++; return true; }
	static function Delete($id) { self::$writes++; return true; }
	static function SetPropertyValuesEx($id, $iblock, $properties) { self::$writes++; self::$propertyIblock = $iblock; }
}
/** Текущий автор элемента. */
class IblockTestUser { function GetID() { return 7; } }
/** Подставляет форматирование даты портала. */
function ConvertTimeStamp($time, $format) { return date('d.m.Y H:i:s', $time); }
/** Проверка без зависимости от настройки assert в php.ini. */
function checkIblock($condition, $message) { if (!$condition) throw new Exception($message); }
/** Вызывает действие контроллера, подавляя JSON-ответ. */
function runIblockAction($controller, $action, $params) {
	router::$params = $params;
	ob_start();
	try { $controller->$action(); }
	catch (Exception $e) { ob_end_clean(); throw $e; }
	ob_end_clean();
}

$mode = isset($argv[1]) ? $argv[1] : 'default';
if ($mode === 'custom' || $mode === 'invalid') {
	// Отдельный процесс для каждого режима: PHP-константы нельзя переопределять.
	define('BXDASH_JOB_IBLOCK_ID', $mode === 'custom' ? '120' : '0');
	define('BXDASH_PLAN_IBLOCK_ID', $mode === 'custom' ? 121 : '91x');
}
require __DIR__.'/../back/app/ctl/controller_job.php';
require __DIR__.'/../back/app/ctl/controller_plan.php';
$USER = new IblockTestUser();
foreach (array('job', 'plan') as $type) {
	$class = 'controller_'.$type;
	$ctl = new $class();
	if ($mode !== 'custom') {
		// Все пути должны завершиться ошибкой до обращения к записи Bitrix.
		foreach (array('action_load', 'action_get', 'action_create', 'action_update', 'action_delete') as $action) {
			try {
				runIblockAction($ctl, $action, array('id' => 1001, 'from' => 1, 'to' => time(), 'users' => '7', 'title' => 'Тест', 'user' => 7, 'deadline' => time()));
				throw new Exception('Принята отсутствующая или некорректная настройка');
			} catch (IblockTestHalt $e) {
				checkIblock($e->getCode() === 500, 'Нужна ошибка конфигурации');
				checkIblock(strpos($e->getMessage(), 'BXDASH_'.strtoupper($type).'_IBLOCK_ID') !== false, 'Ошибка должна назвать настройку');
			}
		}
		checkIblock(CIBlockElement::$writes === 0, 'Запись без настройки запрещена');
		continue;
	}
	$expected = $type === 'job' ? 120 : 121;
	checkIblock($class::iblockId() === $expected, 'Неверный ID '.$type);
	$class::loadPeriodUsers(time() - 86400, time() + 86400, array(7));
	checkIblock(CIBlockElement::$filter['IBLOCK_ID'] === $expected, 'Неверный инфоблок периода');
	$ctl = new $class();
	runIblockAction($ctl, 'action_get', array('id' => 1001));
	checkIblock(CIBlockElement::$filter['IBLOCK_ID'] === $expected, 'Неверный инфоблок get');
	runIblockAction($ctl, 'action_create', array('title' => 'Тест', 'user' => 7, 'deadline' => time()));
	checkIblock(CIBlockElement::$data['IBLOCK_ID'] === $expected, 'Неверный инфоблок create');
	// Несуществующий или чужой элемент нельзя изменять, удалять или двигать в канбане.
	CIBlockElement::$belongs = false;
	$writes = CIBlockElement::$writes;
	foreach (array('action_update', 'action_delete') as $action) {
		try {
			runIblockAction($ctl, $action, array('id' => 9999, 'title' => 'Чужой', 'priority' => 2, 'stage' => 10));
			throw new Exception('Принят элемент чужого инфоблока');
		} catch (IblockTestHalt $e) { checkIblock($e->getCode() === 409, 'Нужен отказ 409'); }
		checkIblock(CIBlockElement::$filter['IBLOCK_ID'] === $expected, 'Проверка должна ограничивать инфоблок');
	}
	checkIblock(CIBlockElement::$writes === $writes, 'Чужие данные изменены');
	CIBlockElement::$belongs = true;
	if ($type === 'job') {
		runIblockAction($ctl, 'action_update', array('id' => 1001, 'sorting' => 10, 'priority' => 2));
		checkIblock(CIBlockElement::$propertyIblock === $expected, 'Неверный инфоблок записи свойств');
	}
}
echo 'iblocks '.$mode.": OK\n";
