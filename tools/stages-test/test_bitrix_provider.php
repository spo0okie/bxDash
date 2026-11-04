<?php
/** Контракт штатного провайдера без портала, MySQL и изменения схемы БД. */
namespace Bitrix\Tasks\Kanban {
	/** Общий результат ORM для чтения и записи. */
	class TestResult {
		private $rows;
		private $id;
		function __construct($rows = array(), $id = 0) { $this->rows = $rows; $this->id = $id; }
		function fetch() { return array_shift($this->rows); }
		function isSuccess() { return true; }
		function getId() { return $this->id; }
		function getErrorMessages() { return array(); }
	}
	/** Минимальная ORM: фильтры, связи и снимки транзакций проверяются настоящим провайдером. */
	class TestTable {
		static $stages = array();
		static $bindings = array();
		static $failAdd = false;
		static $queries = array();
		/** Читает строки с учётом типа стадии и принадлежности личному плану. */
		static function getList($params) {
			$isStage = get_called_class() === __NAMESPACE__.'\\StagesTable';
			$source = $isStage ? self::$stages : self::$bindings;
			self::$queries[] = array(get_called_class(), $params);
			$out = array();
			foreach ($source as $row) {
				$values = $row;
				if (!$isStage) {
					$stage = isset(self::$stages[$row['STAGE_ID']]) ? self::$stages[$row['STAGE_ID']] : array();
					$values['STAGE.ENTITY_TYPE'] = isset($stage['ENTITY_TYPE']) ? $stage['ENTITY_TYPE'] : null;
					$values['USER_ID'] = isset($stage['ENTITY_ID']) ? $stage['ENTITY_ID'] : null;
				}
				$match = true;
				foreach ($params['filter'] as $field => $expected) {
					$field = ltrim($field, '=@');
					$value = isset($values[$field]) ? $values[$field] : null;
					if (is_array($expected) ? !in_array($value, $expected) : $value != $expected) $match = false;
				}
				if ($match) $out[] = $values;
			}
			if (isset($params['order'])) {
				$order = $params['order'];
				usort($out, function ($a, $b) use ($order) {
					foreach ($order as $key => $direction) {
						if ($a[$key] != $b[$key]) return $a[$key] < $b[$key] ? -1 : 1;
					}
					return 0;
				});
			}
			return new TestResult($out);
		}
		/** Добавляет только строки, сохраняя независимые ID стадий и связей. */
		static function add($fields) {
			if (self::$failAdd) throw new \Exception('Тестовая ошибка записи');
			$isStage = get_called_class() === __NAMESPACE__.'\\StagesTable';
			$source = $isStage ? self::$stages : self::$bindings;
			$id = $source ? max(array_keys($source)) + 1 : 1;
			$fields['ID'] = $id;
			if ($isStage) {
				$fields += array('SYSTEM_TYPE' => null);
				self::$stages[$id] = $fields;
			} else self::$bindings[$id] = $fields;
			return new TestResult(array(), $id);
		}
		/** Меняет только указанную строку тестового хранилища. */
		static function update($id, $fields) {
			if (get_called_class() === __NAMESPACE__.'\\StagesTable') self::$stages[$id] = array_merge(self::$stages[$id], $fields);
			else self::$bindings[$id] = array_merge(self::$bindings[$id], $fields);
			return new TestResult();
		}
		/** Удаляет указанную строку тестового хранилища. */
		static function delete($id) {
			if (get_called_class() === __NAMESPACE__.'\\StagesTable') unset(self::$stages[$id]);
			else unset(self::$bindings[$id]);
			return new TestResult();
		}
	}
	/** API личных стадий: U отличается от временной шкалы P. */
	class StagesTable extends TestTable {
		const WORK_MODE_USER = 'U';
		const SYS_TYPE_NEW = 'NEW';
		static $mode = 'G';
		static function getWorkMode() { return self::$mode; }
		static function setWorkMode($mode) { self::$mode = $mode; }
		static function getStages($userId) {
			self::add(array('TITLE' => 'Новые', 'SORT' => 100, 'COLOR' => '00C4FB', 'ENTITY_ID' => $userId,
				'ENTITY_TYPE' => self::$mode, 'SYSTEM_TYPE' => 'NEW'));
			$rows = self::getList(array('filter' => array('ENTITY_ID' => $userId, 'ENTITY_TYPE' => self::$mode)));
			$result = array();
			while ($row = $rows->fetch()) $result[] = $row;
			return $result;
		}
		static function systemDelete($id) { return self::delete($id); }
	}
	/** Связи задач имеют собственный первичный ID. */
	class TaskStageTable extends TestTable {}
}

namespace Bitrix\Main {
	/** Снимки данных позволяют проверить откат при ошибке записи. */
	class TestConnection {
		private $snapshot;
		function startTransaction() { $this->snapshot = array(\Bitrix\Tasks\Kanban\TestTable::$stages, \Bitrix\Tasks\Kanban\TestTable::$bindings, \CUserOptions::$data); }
		function commitTransaction() {}
		function rollbackTransaction() {
			list(\Bitrix\Tasks\Kanban\TestTable::$stages, \Bitrix\Tasks\Kanban\TestTable::$bindings, \CUserOptions::$data) = $this->snapshot;
		}
	}
	/** Общая тестовая транзакция вместо реального соединения с БД. */
	class Application {
		static function getConnection() { return new TestConnection(); }
	}
}

namespace {
	use Bitrix\Tasks\Kanban\TestTable;
	use Bitrix\Tasks\Kanban\StagesTable;
	/** Настройки пользователей вместо дополнительных таблиц bxDash. */
	class CUserOptions {
		static $data = array();
		static function GetOption($category, $name, $default, $user) { return isset(self::$data[$user]) ? self::$data[$user] : $default; }
		static function SetOption($category, $name, $value, $common, $user) { self::$data[$user] = $value; return true; }
		static function GetList($order, $filter) { return new TestOptionsRows(array_keys(self::$data)); }
	}
	/** Курсор пользователей с настройками канбана. */
	class TestOptionsRows {
		private $ids;
		function __construct($ids) { $this->ids = $ids; }
		function Fetch() { return $this->ids ? array('USER_ID' => array_shift($this->ids)) : false; }
	}
	/** Текущая сессия: обычный владелец, администратор и отказ доступа к задаче. */
	class TestUser {
		public $id = 1229;
		public $admin = false;
		function GetID() { return $this->id; }
		function IsAdmin() { return $this->admin; }
	}
	/** Проверяет, что перенос задачи проходит штатную проверку доступа. */
	class CTaskItem {
		static $allowed = true;
		function __construct($id, $user) {}
		function GetData() { if (!self::$allowed) throw new Exception('Нет доступа к задаче'); return array('ID' => 120577); }
	}
	/** Явные утверждения не зависят от php.ini. */
	function checkNative($condition, $message) { if (!$condition) throw new Exception($message); }
	/** Ожидает отказ без изменения данных. */
	function nativeReject($callback) {
		$before = array(TestTable::$stages, TestTable::$bindings, CUserOptions::$data);
		try { $callback(); } catch (Exception $e) {
			checkNative($before === array(TestTable::$stages, TestTable::$bindings, CUserOptions::$data), 'Ошибка изменила данные');
			return;
		}
		throw new Exception('Ожидаемый отказ не получен');
	}
	/** Строка штатной стадии для независимых личных планов и проектов. */
	function nativeRow($id, $user, $type, $sort, $system = null) {
		return array('ID' => $id, 'ENTITY_ID' => $user, 'ENTITY_TYPE' => $type, 'TITLE' => 'Колонка '.$id,
			'SORT' => $sort, 'COLOR' => '00C4FB', 'SYSTEM_TYPE' => $system);
	}

	require __DIR__.'/../../back/app/models/stages_provider.php';
	require __DIR__.'/../../back/app/models/stages_provider_bitrix.php';
	$USER = new TestUser();
	TestTable::$stages = array(
		5168 => nativeRow(5168, 1229, 'U', 100, 'NEW'),
		5169 => nativeRow(5169, 1229, 'U', 200),
		5170 => nativeRow(5170, 1229, 'P', 300, 'NEW'),
		5171 => nativeRow(5171, 1229, 'G', 400, 'NEW'),
		5172 => nativeRow(5172, 916, 'U', 100, 'NEW'),
	);
	TestTable::$bindings = array(
		1 => array('ID' => 1, 'TASK_ID' => 120577, 'STAGE_ID' => 5169),
		2 => array('ID' => 2, 'TASK_ID' => 120577, 'STAGE_ID' => 5172),
		3 => array('ID' => 3, 'TASK_ID' => 120577, 'STAGE_ID' => 5171),
	);
	$p = new stages_provider_bitrix();
	$rows = $p->getStages(1229);
	checkNative(array_column($rows, 'ID') === array(5168, 5169), 'Нужны только личные стадии U');
	checkNative($rows[0]['IS_DEFAULT'] === 'Y' && $rows[0]['COLOR'] === '#00C4FB', 'Неверный контракт стадии');
	checkNative($p->getStage(5170) === null && $p->getStage(5171) === null, 'Нельзя смешивать проекты и временную шкалу');
	checkNative($p->getItemStages('task', array(120577)) === array(120577 => array(1229 => 5169, 916 => 5172)), 'Неверная карта штатных привязок');
	$p->setItemStage('task', 120577, 1229, 5168);
	checkNative($p->getItemStages('task', array(120577))[120577] === array(916 => 5172, 1229 => 5168), 'Перенос затронул чужой личный план');
	checkNative(TestTable::$bindings[3]['STAGE_ID'] === 5171, 'Перенос затронул проект');
	CTaskItem::$allowed = false;
	nativeReject(function () use ($p) { $p->setItemStage('task', 120577, 1229, 5169); });
	CTaskItem::$allowed = true;
	TestTable::$failAdd = true;
	nativeReject(function () use ($p) { $p->setItemStage('task', 120577, 1229, 5169); });
	TestTable::$failAdd = false;
	nativeReject(function () use ($p) { $p->setItemStage('task', 120577, 1229, 5172); });
	nativeReject(function () use ($p) { $p->updateStage(5172, array('TITLE' => 'Чужая')); });
	nativeReject(function () use ($p) { $p->deleteStage(5168); });
	$newId = $p->createStage(1229, 'Проверка', '#ff0000');
	$p->updateStage($newId, array('TITLE' => 'Готово', 'COLOR' => '#123456'));
	checkNative($p->getStage($newId)['TITLE'] === 'Готово' && TestTable::$stages[$newId]['COLOR'] === '123456', 'Не сохранены название и цвет');
	$p->reorderStages(1229, array($newId, 5168, 5169), array(5169));
	checkNative(array_column($p->getStages(1229), 'ID') === array($newId, 5168, 5169), 'Не сохранён порядок');
	checkNative($p->getStage(5169)['STACKED'] === 'Y', 'Не сохранена стопка');
	$p->setItemStage('job', 10, 1229, $newId);
	$p->setItemStage('ticket', 11, 1229, $newId);
	checkNative($p->getItemStages('job', array(10)) === array(10 => array(1229 => $newId)), 'Не сохранена работа');
	$p->setItemStage('task', 120577, 1229, $newId);
	checkNative($p->deleteStage($newId, 5169) === 5169, 'Не выбран столбец переноса');
	checkNative($p->getItemStages('job', array(10)) === array(10 => array(1229 => 5169)), 'Удаление потеряло работу');
	checkNative($p->getItemStages('ticket', array(11)) === array(11 => array(1229 => 5169)), 'Удаление потеряло заявку');
	checkNative($p->getItemStages('task', array(120577))[120577][1229] === 5169, 'Удаление потеряло задачу');
	$p->removeItem('job', 10);
	checkNative($p->getItemStages('job', array(10)) === array(), 'Удалённая работа осталась привязанной');
	$p->setItemStage('task', 120577, 1229, null);
	checkNative($p->getItemStages('task', array(120577))[120577][1229] === 5168, 'Сброс должен сохранить штатную привязку к NEW');
	$p->removeItem('task', 120577);
	checkNative($p->getItemStages('task', array(120577)) === array() && TestTable::$bindings[3]['STAGE_ID'] === 5171,
		'Очистка личных привязок не должна удалять проектные');
	$USER->id = 2000;
	checkNative(count($p->getStages(2000)) === 1, 'Первое обращение должно создать штатные стадии');
	$USER->id = 2001;
	TestTable::$failAdd = true;
	nativeReject(function () use ($p) { $p->getStages(2001); });
	TestTable::$failAdd = false;
	checkNative(StagesTable::$mode === 'G', 'Провайдер изменил глобальный режим Bitrix');
	echo "OK: штатные стадии U, привязки, CRUD, права, стопки и откат ошибок\n";
}
