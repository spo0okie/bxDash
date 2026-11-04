<?php
/**
 * Диагностика TZ без изменения бизнес-данных и настроек БД (PHP 5).
 * Скопировать на портал рядом с api.php. Открывать администратором:
 * ?mode=api&taskId=123 и ?mode=native&taskId=123 в разных запросах.
 */
define('NO_KEEP_STATISTIC', true);
define('NO_AGENT_STATISTIC', true);
define('NOT_CHECK_FILE_PERMISSIONS', true);

/** Снимок PHP без вызова CTimeZone, чтобы не прогревать его возможный кеш. */
function bxdashTimezonePhpSnapshot() {
	return array('timezone' => date_default_timezone_get(), 'now' => date('c'), 'offsetSeconds' => (int)date('Z'));
}

$beforeProlog = bxdashTimezonePhpSnapshot();
$mode = isset($_GET['mode']) && $_GET['mode'] === 'native' ? 'native' : 'api';
// Воспроизводим текущую подмену в api.php, но не отправляем куки браузеру.
$_COOKIE['BITRIX_SM_TIME_ZONE'] = '-180';
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

global $USER, $DB;
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
if (!$USER->IsAuthorized() || !$USER->IsAdmin()) {
	header('HTTP/1.1 403 Forbidden');
	exit(json_encode(array('error' => 'Откройте диагностику в браузере администратора портала')));
}

// Модули загружаем в том же порядке, что в API; настройки соединения не меняем.
foreach (array('iblock', 'tasks', 'support', 'search', 'forum') as $module) CModule::IncludeModule($module);
$afterProlog = bxdashTimezonePhpSnapshot();
if ($mode === 'api') date_default_timezone_set('Europe/Moscow');

$result = array(
	'mode' => $mode,
	'phpVersion' => PHP_VERSION,
	'bitrixVersion' => defined('SM_VERSION') ? SM_VERSION : null,
	'phpBeforeProlog' => $beforeProlog,
	'phpAfterProlog' => $afterProlog,
	'phpEffective' => bxdashTimezonePhpSnapshot(),
	'utcNow' => gmdate('c'),
	'frontendExpectedOffsetSeconds' => 10800,
	'bitrix' => array(
		'timezoneEnabled' => CTimeZone::Enabled(),
		'userMinusServerSeconds' => CTimeZone::GetOffset(),
		'optionUseTimezone' => COption::GetOptionString('main', 'use_time_zones', ''),
		'optionDefaultTimezone' => COption::GetOptionString('main', 'default_time_zone', ''),
		'userTimezone' => $USER->GetParam('TIME_ZONE'),
		'userAutoTimezone' => $USER->GetParam('AUTO_TIME_ZONE'),
		'legacyCookieValue' => method_exists('CTimeZone', 'GetCookieValue') ? CTimeZone::GetCookieValue() : null,
		'modernCookieTimezone' => method_exists('CTimeZone', 'getTzCookie') ? CTimeZone::getTzCookie() : null,
		'formattedNow' => ConvertTimeStamp(time(), 'FULL'),
	),
);

try {
	// SELECT не меняет session.time_zone и не переинтерпретирует сохранённые DATETIME.
	$query = $DB->Query("SELECT @@session.time_zone AS sessionTimezone, @@global.time_zone AS globalTimezone, @@system_time_zone AS systemTimezone, NOW() AS localNow, UTC_TIMESTAMP() AS utcNow, UNIX_TIMESTAMP() AS unixNow, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS offsetSeconds");
	$result['mysql'] = $query->Fetch();
	$taskId = isset($_GET['taskId']) ? (int)$_GET['taskId'] : 0;
	if ($taskId > 0) {
		// Только даты одной указанной задачи; названия и содержимое не выгружаем.
		$query = $DB->Query('SELECT ID, CREATED_DATE, DEADLINE, START_DATE_PLAN, CLOSED_DATE FROM b_tasks WHERE ID = ' . $taskId);
		$result['taskRawDatabase'] = $query->Fetch();
		$tasks = CTasks::GetList(array(), array('ID' => $taskId, 'CHECK_PERMISSIONS' => 'Y'));
		$row = $tasks ? $tasks->Fetch() : false;
		$result['taskBitrixApi'] = $row ? array_intersect_key($row, array_flip(array('ID', 'CREATED_DATE', 'DEADLINE', 'START_DATE_PLAN', 'CLOSED_DATE'))) : null;
	}
} catch (Exception $error) {
	$result['error'] = $error->getMessage();
} catch (Throwable $error) {
	$result['error'] = $error->getMessage();
}
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
