<?php
/** Проверяет пакетную загрузку обеих сторон зависимостей без портала и базы данных. */
class stages_provider {}

/** Минимальный курсор Bitrix. */
class DependencyTestResult {
	private $rows;
	function __construct($rows) { $this->rows = $rows; }
	function Fetch() { return array_shift($this->rows); }
}

/** Связи охватывают задачи вне выборки, включая цепочку с несколькими следующими. */
class CTaskDependence {
	static $queries = array();
	static function GetList($order, $filter) {
		self::$queries[] = $filter;
		$links = array(
			array('TASK_ID' => '1', 'DEPENDS_ON_ID' => '9'),
			array('TASK_ID' => '2', 'DEPENDS_ON_ID' => '1'),
			array('TASK_ID' => '3', 'DEPENDS_ON_ID' => '1'),
			array('TASK_ID' => '8', 'DEPENDS_ON_ID' => '2'),
		);
		$rows = array();
		foreach ($links as $link) {
			foreach ($filter as $field => $ids) {
				if (in_array((int)$link[$field], $ids, true)) $rows[] = $link;
			}
		}
		return new DependencyTestResult($rows);
	}
}

/** Проверки не зависят от настройки PHP assertions. */
function checkDependency($condition, $message) {
	if (!$condition) throw new Exception($message);
}

require_once __DIR__ . '/../back/app/ctl/controller_task.php';
$rows = controller_task::attachDependencies(array(array('ID' => '1'), array('ID' => '2'), array('ID' => '7')));
checkDependency($rows[0]['PREV_TASK_IDS'] === array(9), 'Предыдущая задача вне выборки потеряна');
checkDependency($rows[0]['NEXT_TASK_IDS'] === array(2, 3), 'Следующие задачи вне выборки потеряны');
checkDependency($rows[1]['PREV_TASK_IDS'] === array(1), 'Неверное направление связи');
checkDependency($rows[1]['NEXT_TASK_IDS'] === array(8), 'Не загружен конец цепочки');
checkDependency($rows[2]['NEXT_TASK_IDS'] === array() && $rows[2]['PREV_TASK_IDS'] === array(), 'Для задачи без связей нужны два пустых списка');
checkDependency(CTaskDependence::$queries === array(array('TASK_ID' => array(1, 2, 7)), array('DEPENDS_ON_ID' => array(1, 2, 7))), 'Нужны два пакетных запроса на всю выборку');
controller_task::attachDependencies(array());
checkDependency(count(CTaskDependence::$queries) === 2, 'Пустая выборка не должна обращаться к Bitrix');
echo "OK: task dependencies\n";
