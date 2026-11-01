<?php
/** Пример серверной конфигурации: скопировать в portal.config.php рядом с index.php. */
return array(
	// auto выбирает API по доступным расширениям; можно явно legacy или modern.
	'profile' => 'auto',
	// Списки полностью заменяют значения по умолчанию соответствующего профиля.
	// legacy: имена CJSCore, например array('ajax', 'popup', 'date', 'autosave').
	// modern: имена Extension, например array('main.core', 'main.popup', 'main.date').
	// 'extensions' => array('main.core', 'main.popup', 'main.date'),
	// Только modern: дополнительные библиотеки CJSCore.
	// 'coreExtensions' => array('sidepanel'),
	// Дополнительные JS-файлы; [] отключает штатные служебные файлы legacy.
	// 'scripts' => array(),
);
