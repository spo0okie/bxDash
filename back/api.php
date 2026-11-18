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
require_once "conf.php";

if (!defined('BXDASH_TIMEZONE') || !is_string(BXDASH_TIMEZONE) || BXDASH_TIMEZONE === '') {
	router::haltJson('Задайте BXDASH_TIMEZONE в back/conf.php', 500);
}

// Пояс API должен совпадать с поясом хранения дат данного портала.
$bitrixServerOffset = date('P');
if (!@date_default_timezone_set(BXDASH_TIMEZONE) || date('P') !== $bitrixServerOffset) {
	router::haltJson('BXDASH_TIMEZONE должен совпадать с серверным часовым поясом Bitrix', 500);
}
// Пояс дат API не зависит от профиля и куки пользователя.
CTimeZone::Disable();
$globalTzOffset = (int)date('Z');

router::init();

?>
