<?php
/** Контракт категорий без портала: справочник, совместимость и проверка существования ID. */
class stages_provider { static function applyRequest($type, $id) {} }
class ticket_hold_intervals {}
class CategoryTestHalt extends Exception {}
/** Параметры HTTP и проверяемые отказы API. */
class router {
	static $params = array();
	static function getRoute($number, $name) { return isset(self::$params[$name]) ? self::$params[$name] : null; }
	static function haltJson($message, $code = 500) { throw new CategoryTestHalt($message, $code); }
}
/** Справочник намеренно возвращает другой порядок и неэкранированное название. */
class CTicketDictionary {
	static $rows = array(array('ID' => 43, 'NAME' => 'Поддержка & помощь'), array('ID' => 45, 'NAME' => 'Оборудование'));
	static function GetList(&$by, &$order, $filter, &$isFiltered) {
		checkCategory($filter === array('TYPE' => 'C', 'LID' => 's1'), 'Нужен справочник категорий текущего сайта');
		return new CategoryTestRows();
	}
}
/** Итератор справочника. */
class CategoryTestRows {
	private $index = 0;
	function Fetch() { return isset(CTicketDictionary::$rows[$this->index]) ? CTicketDictionary::$rows[$this->index++] : false; }
}
/** Запоминает данные фактически создаваемой заявки. */
class CTicket {
	static $fields;
	static function Set($fields, &$message, $id, $checkRights) { self::$fields = $fields; return 101; }
}
/** Проверка, независимая от php.ini assertions. */
function checkCategory($condition, $message) { if (!$condition) throw new Exception($message); }
/** Создаёт заявку, подавляя JSON-вывод. */
function createCategoryTicket($params) {
	router::$params = array_merge(array('text' => 'Заголовок', 'owner' => 1, 'responsible' => 2), $params);
	ob_start();
	try { $ctl = new controller_ticket(); $ctl->action_create(); }
	catch (Exception $e) { ob_end_clean(); throw $e; }
	ob_end_clean();
}
require __DIR__.'/../back/app/ctl/controller_ticket.php';
createCategoryTicket(array());
checkCategory(CTicket::$fields['CATEGORY_ID'] === 43, 'Без настройки нужен ID 43');
define('TICKET_CATEGORY_ID', 45);
checkCategory(controller_ticket::categories() === array(array('id' => 43, 'name' => 'Поддержка & помощь'), array('id' => 45, 'name' => 'Оборудование')), 'Бэкенд возвращает справочник с исходными названиями');
createCategoryTicket(array());
checkCategory(CTicket::$fields['CATEGORY_ID'] === 45, 'Старый клиент сохраняет прежний серверный дефолт');
createCategoryTicket(array('category' => '43'));
checkCategory(CTicket::$fields['CATEGORY_ID'] === 43, 'Выбор должен попадать в CTicket::Set');
foreach (array(99, '43x', array(43), '', 0) as $invalid) {
	CTicket::$fields = null;
	try { createCategoryTicket(array('category' => $invalid)); throw new Exception('Недопустимая категория принята'); }
	catch (CategoryTestHalt $e) { checkCategory($e->getCode() === 409, 'Ожидался HTTP 409'); }
	checkCategory(CTicket::$fields === null, 'CTicket::Set не должен вызываться');
}
CTicketDictionary::$rows = array();
try { createCategoryTicket(array('category' => 43)); throw new Exception('Удалённая категория принята'); }
catch (CategoryTestHalt $e) { checkCategory($e->getCode() === 409, 'Удалённая категория должна отклоняться'); }
echo "ticket categories: OK\n";
