<?php
/** Настройки API: скопировать в conf.php рядом с api.php или добавить в существующий. */

// Обязательные ID именно этого портала: замените null после проверки инфоблоков.
define('BXDASH_JOB_IBLOCK_ID', null);
define('BXDASH_PLAN_IBLOCK_ID', null);
define('BXDASH_MEMO_IBLOCK_ID', null);

// auto: штатный личный канбан на новом Bitrix, собственное хранилище на старом.
// Укажите table явно, если нужно продолжить использовать существующие bxdash_*.
// bitrix требует штатного API и при его отсутствии завершится ошибкой.
$stagesProvider = 'auto';
