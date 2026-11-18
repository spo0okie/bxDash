<?php

/** Ресурсы установленного Bitrix для родительской страницы дашборда. */
class controller_portal {
	/** Возвращает CSS, JavaScript и inline-настройки в порядке вывода Bitrix. */
	public function action_resources() {
		global $APPLICATION, $bitrixResources;

		$config = isset($bitrixResources) ? $bitrixResources : array();
		$profile = isset($config['profile']) ? $config['profile'] : 'auto';
		$root = $_SERVER['DOCUMENT_ROOT'];
		$modernAvailable = class_exists('Bitrix\\Main\\UI\\Extension')
			&& is_file($root . '/bitrix/js/main/popup/config.php')
			&& is_file($root . '/bitrix/js/main/date/config.php');
		if ($profile === 'auto') $profile = $modernAvailable ? 'modern' : 'legacy';
		if (($profile !== 'legacy' && $profile !== 'modern') || ($profile === 'modern' && !$modernAvailable)) {
			router::haltJson('Недоступный профиль ресурсов Bitrix в back/conf.php', 500);
		}

		// Bitrix сам разрешает зависимости зарегистрированных расширений.
		$hasTaskFullCard = false;
		if ($profile === 'modern') {
			$taskCardExtension = 'tasks.v2.application.task-full-card';
			$hasTaskFullCard = is_file($root . '/bitrix/js/tasks/v2/application/task-full-card/config.php');
			// Для новой карточки регистрируем SidePanel через тот же API и оставляем Bitrix выбор её зависимостей.
			$defaultExtensions = $hasTaskFullCard ? array('main.core', 'main.sidepanel') : array('main.core', 'main.popup', 'main.date');
			$extensions = isset($config['extensions']) ? $config['extensions'] : $defaultExtensions;
			if ($hasTaskFullCard && !in_array($taskCardExtension, $extensions, true)) {
				$extensions[] = $taskCardExtension;
			}
			// Карточка запрашивает эти расширения отдельно при регистрации меню сообщений.
			if ($hasTaskFullCard && is_file($root . '/bitrix/js/tasks/v2/lib/result-message-menu/config.php')
				&& is_file($root . '/bitrix/js/im/v2/lib/menu/config.php')) {
				$extensions = array_values(array_unique(array_merge($extensions, array(
					'im.v2.lib.menu', 'tasks.v2.lib.result-message-menu',
				))));
			}
			\Bitrix\Main\UI\Extension::load($extensions);
			$coreExtensions = isset($config['coreExtensions']) ? $config['coreExtensions'] : ($hasTaskFullCard ? array() : array('sidepanel'));
			if ($coreExtensions) \CJSCore::Init($coreExtensions);
		} else {
			$extensions = isset($config['extensions']) ? $config['extensions']
				: array('ajax', 'json', 'ls', 'popup', 'date', 'fx', 'webrtc', 'dd', 'tooltip', 'timer', 'window', 'autosave');
			\CJSCore::Init($extensions);
		}
		$scripts = isset($config['scripts']) ? $config['scripts'] : ($profile === 'legacy'
			? array('/bitrix/js/main/session.js', '/bitrix/js/main/utils.js', '/bitrix/js/main/rating_like.js', '/bitrix/js/main/dd.js')
			: array());
		foreach ($scripts as $script) $APPLICATION->AddHeadScript($script);

		// Inline-настройки могут содержать данные текущей сессии портала.
		header('Cache-Control: private, no-store');
		echo '<!doctype html><html><head><meta name="bxdash-portal-assets" content="1"'
			. ($hasTaskFullCard ? ' data-task-full-card="1"' : '') . '>';
		$APPLICATION->ShowCSS();
		$APPLICATION->ShowHeadStrings();
		$APPLICATION->ShowHeadScripts();
		echo '</head><body>';
		$APPLICATION->ShowBodyScripts();
		echo '</body></html>';
		return router::FINISH_BITRIX_PAGE;
	}
}
