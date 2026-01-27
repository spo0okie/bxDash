<?php

require_once($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/bx_root.php");
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
CModule::IncludeModule("tasks");
CModule::IncludeModule("support");

$d = new DateTime();
$tz = $d->getTimezone();
$tzUTC = new DateTimeZone('UTC');
$dUTC = new DateTime('now', $tzUTC);
$globalTzOffset=CTimeZone::GetOffset()+$tz->getOffset($dUTC);

require_once 'app/router.php';

router::init();

?>