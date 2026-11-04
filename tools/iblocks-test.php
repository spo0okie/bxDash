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
	function Fetch() {
		// Фильтр автора должен отсечь чужую заметку до любой записи.
		$own = !isset(CIBlockElement::$filter['CREATED_BY']) || CIBlockElement::$ownMemo;
		return CIBlockElement::$belongs && $own ? array('ID' => 1001) : false;
	}
}
/** Запоминает аргументы API Bitrix для проверок чтения и записи. */
class CIBlockElement {
	static $belongs = true;
	static $ownMemo = true;
	static $writes = 0;
	static $filter;
	static $data;
	static $propertyIblock;
	static function GetList($sort, $filter, $group, $nav, $select) {
		self::$filter = $filter;
		return new IblockTestRows();
	}
	function Add($data) { self::$writes++; self::$data = $data; return 1001; }
	function Update($id, $data) { self::$writes++; self::$data = $data; return true; }
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
	define('BXDASH_MEMO_IBLOCK_ID', $mode === 'custom' ? 122 : null);
}
require __DIR__.'/../back/app/ctl/controller_job.php';
require __DIR__.'/../back/app/ctl/controller_plan.php';
require __DIR__.'/../back/app/ctl/controller_memo.php';
$USER = new IblockTestUser();
foreach (array('job', 'plan', 'memo') as $type) {
	$class = 'controller_'.$type;
	$ctl = new $class();
	if ($mode !== 'custom') {
		// Все пути должны завершиться ошибкой до обращения к записи Bitrix.
		foreach (array('action_load', 'action_get', 'action_create', 'action_update', 'action_delete') as $action) {
			try {
				runIblockAction($ctl, $action, array('id' => 1001, 'from' => 1, 'to' => time(), 'users' => '7', 'title' => 'Тест', 'text' => 'Заметка', 'user' => 7, 'deadline' => time()));
				throw new Exception('Принята отсутствующая или некорректная настройка');
			} catch (IblockTestHalt $e) {
				checkIblock($e->getCode() === 500, 'Нужна ошибка конфигурации');
				checkIblock(strpos($e->getMessage(), 'BXDASH_'.strtoupper($type).'_IBLOCK_ID') !== false, 'Ошибка должна назвать настройку');
			}
		}
		checkIblock(CIBlockElement::$writes === 0, 'Запись без настройки запрещена');
		continue;
	}
	$expectedIds = array('job' => 120, 'plan' => 121, 'memo' => 122);
	$expected = $expectedIds[$type];
	checkIblock($class::iblockId() === $expected, 'Неверный ID '.$type);
	$class::loadPeriodUsers(time() - 86400, time() + 86400, array(7));
	checkIblock(CIBlockElement::$filter['IBLOCK_ID'] === $expected, 'Неверный инфоблок периода');
	if ($type === 'memo') checkIblock(CIBlockElement::$filter['CREATED_BY'] === 7, 'Период заметок ограничен автором сессии');
	$ctl = new $class();
	runIblockAction($ctl, 'action_get', array('id' => 1001));
	checkIblock(CIBlockElement::$filter['IBLOCK_ID'] === $expected, 'Неверный инфоблок get');
	if ($type === 'memo') checkIblock(CIBlockElement::$filter['CREATED_BY'] === 7, 'Чтение заметки ограничено автором');
	runIblockAction($ctl, 'action_create', array('title' => 'Тест', 'text' => "Заметка\nВторая строка", 'user' => 7, 'deadline' => time()));
	checkIblock(CIBlockElement::$data['IBLOCK_ID'] === $expected, 'Неверный инфоблок create');
	if ($type === 'memo') {
		checkIblock(CIBlockElement::$data['CREATED_BY'] === 7 && CIBlockElement::$data['NAME'] === 'Заметка'
			&& CIBlockElement::$data['DETAIL_TEXT'] === "Заметка\nВторая строка", 'Текст и автор заметки должны попадать в стандартные поля');
	}
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
	if ($type === 'memo') {
		CIBlockElement::$ownMemo = false;
		$writes = CIBlockElement::$writes;
		foreach (array('action_update', 'action_delete') as $action) {
			try {
				runIblockAction($ctl, $action, array('id' => 1001, 'text' => 'Чужая заметка'));
				throw new Exception('Принята чужая заметка');
			} catch (IblockTestHalt $e) { checkIblock($e->getCode() === 409, 'Нужен отказ 409 для чужой заметки'); }
		}
		checkIblock(CIBlockElement::$writes === $writes, 'Чужая заметка изменена');
		CIBlockElement::$ownMemo = true;
		runIblockAction($ctl, 'action_update', array('id' => 1001, 'text' => 'Новый текст'));
		checkIblock(CIBlockElement::$data['DETAIL_TEXT'] === 'Новый текст', 'Своя заметка должна сохраняться');
		runIblockAction($ctl, 'action_delete', array('id' => 1001));
		checkIblock(CIBlockElement::$writes === $writes + 2, 'Своя заметка должна изменяться и удаляться');
	}
	if ($type === 'job') {
		runIblockAction($ctl, 'action_update', array('id' => 1001, 'sorting' => 10, 'priority' => 2));
		checkIblock(CIBlockElement::$propertyIblock === $expected, 'Неверный инфоблок записи свойств');
	}
}
echo 'iblocks '.$mode.": OK\n";
