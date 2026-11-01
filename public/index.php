<?php
/**
 * Точка входа bxDash на портале Bitrix (PHP 5 совместимый синтаксис).
 * Vite копирует файл в build; HTML и имена бандлов берутся из готовой сборки.
 */
define('NO_KEEP_STATISTIC', true);
define('NO_AGENT_STATISTIC', true);

require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

// Конфиг исполняется только на сервере и не связан с window.__CONFIG__.
$portalConfig = array();
if (is_file(__DIR__ . '/portal.config.php')) {
	$portalConfig = require __DIR__ . '/portal.config.php';
}

$profile = isset($portalConfig['profile']) ? $portalConfig['profile'] : 'auto';
// Проверяем доступность API и расширений, а не условный год выпуска продукта.
$hasModernApi = class_exists('Bitrix\\Main\\UI\\Extension')
	&& is_file($_SERVER['DOCUMENT_ROOT'] . '/bitrix/js/main/popup/config.php')
	&& is_file($_SERVER['DOCUMENT_ROOT'] . '/bitrix/js/main/date/config.php');
if ($profile === 'auto') {
	$profile = $hasModernApi ? 'modern' : 'legacy';
}
if (($profile !== 'legacy' && $profile !== 'modern') || ($profile === 'modern' && !$hasModernApi)) {
	header('HTTP/1.1 500 Internal Server Error');
	exit('bxDash: недоступный профиль Bitrix в portal.config.php');
}

// Имена библиотек разрешает установленный Bitrix вместе с их зависимостями.
$legacyExtensions = array('ajax', 'json', 'ls', 'popup', 'date', 'fx', 'webrtc', 'dd', 'tooltip', 'timer', 'window', 'autosave');
$extensions = isset($portalConfig['extensions']) ? $portalConfig['extensions'] : (
	$profile === 'modern' ? array('main.core', 'main.popup', 'main.date') : $legacyExtensions
);
if ($profile === 'modern') {
	\Bitrix\Main\UI\Extension::load($extensions);
	// Карточки актуального портала могут обращаться к SidePanel родительского окна.
	\CJSCore::Init(isset($portalConfig['coreExtensions']) ? $portalConfig['coreExtensions'] : array('sidepanel'));
} else {
	\CJSCore::Init($extensions);
}

// Старые служебные файлы, не представленные отдельными расширениями.
$scripts = isset($portalConfig['scripts']) ? $portalConfig['scripts'] : (
	$profile === 'legacy' ? array('/bitrix/js/main/session.js', '/bitrix/js/main/utils.js', '/bitrix/js/main/rating_like.js', '/bitrix/js/main/dd.js') : array()
);
foreach ($scripts as $script) {
	$APPLICATION->AddHeadScript($script);
}

$html = is_file(__DIR__ . '/index.html') ? file_get_contents(__DIR__ . '/index.html') : false;
$headStart = $html === false ? false : strpos($html, '<head>');
if ($headStart === false) {
	header('HTTP/1.1 500 Internal Server Error');
	exit('bxDash: рядом с index.php нужен index.html из npm run build');
}

// Используем HTML Vite без копирования списка хешированных бандлов в PHP.
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: private, no-store');
$insertAt = $headStart + strlen('<head>');
echo substr($html, 0, $insertAt);
$APPLICATION->ShowCSS();
$APPLICATION->ShowHeadStrings();
$APPLICATION->ShowHeadScripts();
echo '<script>window.__BXDASH_PORTAL__ = true;</script>';
echo substr($html, $insertAt);

// Эпилог обрабатывает отложенный вывод ресурсов Bitrix.
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/epilog_after.php';
