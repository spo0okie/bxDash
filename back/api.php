<?php

// API сам возвращает JSON-отказ; файловые права портала не должны показывать форму входа.
// Авторизация по cookies/HTTP остаётся штатной: NOT_CHECK_PERMISSIONS здесь не используем.
define('NOT_CHECK_FILE_PERMISSIONS', true);

require_once $_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/bx_root.php";

// MySQL-уровень исторически настроен в TZ +6 (см. UNIX_TIMESTAMP диагностику),
// поэтому все даты в b_ticket/b_tasks/etc. лежат как "+6 wall-clock". Bitrix CTimeZone
// при отдаче конвертирует +6 wall → user_TZ. Единственное, что нам нужно — заставить
// Bitrix считать юзера московским, чтобы конвертация всегда давала MSK-строки.
// Тогда фронт хардкодит '+03:00' при парсинге, и round-trip корректен.
$_COOKIE['BITRIX_SM_TIME_ZONE'] = '-180';

require $_SERVER["DOCUMENT_ROOT"] .
	"/bitrix/modules/main/include/prolog_before.php";
// Инфоблоки работ и планов не зависят от автозагрузки другими модулями.
CModule::IncludeModule("iblock");
CModule::IncludeModule("tasks");
CModule::IncludeModule("support");
CModule::IncludeModule("search");
CModule::IncludeModule("forum");

// Defensive: явно ставим PHP TZ в MSK (если уже там — no-op). Не должно влиять
// на MySQL-уровень и легаси-данные.
date_default_timezone_set('Europe/Moscow');

$d = new DateTime();
$tz = $d->getTimezone();
$tzUTC = new DateTimeZone("UTC");
$dUTC = new DateTime("now", $tzUTC);
$globalTzOffset = CTimeZone::GetOffset() + $tz->getOffset($dUTC);

require_once "app/router.php";
require_once "conf.php";

router::init();

?>
