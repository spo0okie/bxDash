<?php
/** Временная диагностика одной задачи: только чтение, с правами текущей сессии Bitrix. */
define('NO_KEEP_STATISTIC', true);
define('NO_AGENT_STATISTIC', true);
define('NOT_CHECK_FILE_PERMISSIONS', true);
require $_SERVER['DOCUMENT_ROOT'].'/bitrix/modules/main/include/prolog_before.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
global $USER, $APPLICATION;
if (!$USER->IsAuthorized()) {
	header('HTTP/1.1 401 Unauthorized');
	exit(json_encode(array('error' => 'Войдите на портал под пользователем 1229')));
}
if (!CModule::IncludeModule('tasks')) {
	header('HTTP/1.1 500 Internal Server Error');
	exit(json_encode(array('error' => 'Модуль tasks недоступен')));
}

/** Выполняет ограниченную одной задачей выборку и возвращает фильтр вместе с результатом. */
function diagnoseTaskQuery($extra) {
	global $APPLICATION;
	$filter = array_merge(array('ID' => 120577, 'CHECK_PERMISSIONS' => 'Y'), $extra);
	$result = array('filter' => $filter, 'rows' => array());
	try {
		$APPLICATION->ResetException();
		$rows = CTasks::GetList(array('ID' => 'ASC'), $filter);
		if ($rows) {
			while ($row = $rows->Fetch()) $result['rows'][] = $row;
		} else {
			$result['error'] = 'CTasks::GetList вернул false';
		}
		$exception = $APPLICATION->GetException();
		if ($exception) $result['bitrixError'] = $exception->GetString();
	} catch (Exception $e) {
		$result['error'] = $e->getMessage();
	} catch (Throwable $e) {
		$result['error'] = $e->getMessage();
	}
	return $result;
}

$output = array(
	'sessionUserId' => (int)$USER->GetID(),
	'phpVersion' => PHP_VERSION,
	'bitrixVersion' => defined('SM_VERSION') ? SM_VERSION : null,
	'queries' => array(),
);
// Сравниваем одиночный ID, массив ID, статус и комбинацию ролей по отдельности.
$filters = array(
	'byId' => array(),
	'responsibleScalar' => array('RESPONSIBLE_ID' => 1229),
	'responsibleArray' => array('RESPONSIBLE_ID' => array('1229')),
	'openRealStatus' => array('RESPONSIBLE_ID' => 1229, '!REAL_STATUS' => array(5, 7)),
	'openStatus' => array('RESPONSIBLE_ID' => 1229, '!STATUS' => array(5, 7)),
	'roles' => array('::SUBFILTER-1' => array(
		'::LOGIC' => 'OR',
		'::SUBFILTER-1' => array('ACCOMPLICE' => array('1229')),
		'::SUBFILTER-2' => array('RESPONSIBLE_ID' => array('1229')),
	)),
);
// Тот же период и вложенность, что у проблемного запроса dashboard.
$filters['dashboardPeriod'] = $filters['roles'];
$filters['dashboardPeriod']['::LOGIC'] = 'AND';
$filters['dashboardPeriod']['::SUBFILTER-2'] = array(
	'::LOGIC' => 'OR',
	'::SUBFILTER-1' => array('!REAL_STATUS' => array(5, 7)),
	'::SUBFILTER-2' => array(
		'REAL_STATUS' => array(5, 7),
		'>=CLOSED_DATE' => ConvertTimeStamp(1791147600 - 10800, 'FULL'),
	),
);
foreach ($filters as $name => $filter) $output['queries'][$name] = diagnoseTaskQuery($filter);

// Независимый API чтения покажет различие между доступом к задаче и фильтрацией GetList.
try {
	$task = new CTaskItem(120577, (int)$USER->GetID());
	$output['taskItem'] = $task->GetData();
} catch (Exception $e) {
	$output['taskItemError'] = $e->getMessage();
} catch (Throwable $e) {
	$output['taskItemError'] = $e->getMessage();
}
echo json_encode($output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
