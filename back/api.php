<?php
error_log('api');

require_once 'app/router.php';
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') {
	error_log('>_<');
	router::actionPreflight();
	exit;
}

require_once($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/bx_root.php");
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
CModule::IncludeModule("tasks");
CModule::IncludeModule("support");
CModule::IncludeModule("search");
CModule::IncludeModule("forum");

$d = new DateTime();
$tz = $d->getTimezone();
$tzUTC = new DateTimeZone('UTC');
$dUTC = new DateTime('now', $tzUTC);
$globalTzOffset=CTimeZone::GetOffset()+$tz->getOffset($dUTC);

//error_log('api2');

//global $USER;
//$USER->Authorize(1);

//error_log('api3');
router::init();

?>