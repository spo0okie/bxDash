<?php

// API сам возвращает JSON-отказ; файловые права портала не должны показывать форму входа.
// Авторизация по cookies/HTTP остаётся штатной: NOT_CHECK_PERMISSIONS здесь не используем.
define('NOT_CHECK_FILE_PERMISSIONS', true);

require_once $_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/bx_root.php";

require $_SERVER["DOCUMENT_ROOT"] .
	"/bitrix/modules/main/include/prolog_before.php";
// Инфоблоки работ и планов не зависят от автозагрузки другими модулями.
CModule::IncludeModule("iblock");
CModule::IncludeModule("tasks");
CModule::IncludeModule("support");
CModule::IncludeModule("search");
CModule::IncludeModule("forum");

require_once "app/router.php";

// Запоминаем пояс PHP после загрузки Bitrix, до подключения настроек bxDash.
$bitrixServerTimezone = date_default_timezone_get();
$timezoneCheckTime = time();
$bitrixServerOffset = date('P', $timezoneCheckTime);
require_once "conf.php";

if (!defined('BXDASH_TIMEZONE') || !is_string(BXDASH_TIMEZONE) || BXDASH_TIMEZONE === '') {
	router::haltJson(sprintf(
		'Задайте BXDASH_TIMEZONE в back/conf.php. PHP портала использует %s (%s).',
		$bitrixServerTimezone, $bitrixServerOffset
	), 500);
}

if (!@date_default_timezone_set(BXDASH_TIMEZONE)) {
	router::haltJson(sprintf(
		'PHP не распознаёт BXDASH_TIMEZONE «%s» в back/conf.php. PHP портала использует %s (%s).',
		BXDASH_TIMEZONE, $bitrixServerTimezone, $bitrixServerOffset
	), 500);
}

// Сравниваем смещения на один момент, чтобы проверка допускала эквивалентные имена поясов.
$bxDashOffset = date('P', $timezoneCheckTime);
if ($bxDashOffset !== $bitrixServerOffset) {
	router::haltJson(sprintf(
		'В back/conf.php задан BXDASH_TIMEZONE %s (%s), а PHP портала использует %s (%s). Укажите BXDASH_TIMEZONE = %s.',
		BXDASH_TIMEZONE, $bxDashOffset, $bitrixServerTimezone, $bitrixServerOffset, $bitrixServerTimezone
	), 500);
}
// Пояс дат API не зависит от профиля и куки пользователя.
CTimeZone::Disable();
$globalTzOffset = (int)date('Z');

if (router::init() === router::FINISH_BITRIX_PAGE) {
	// Эпилог в глобальной области видимости завершает отложенный вывод Bitrix.
	require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/epilog_after.php';
}

?>
