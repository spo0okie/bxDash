<?php
/** Проверка общего барьера авторизации без подключения живого Bitrix. */
require dirname(__DIR__) . '/back/app/router.php';

/** Подставная сессия воспроизводит результат штатной авторизации Bitrix. */
class ApiAuthTestUser {
	private $authorized;
	function __construct($authorized) { $this->authorized = $authorized; }
	function IsAuthorized() { return $this->authorized; }
}

/** Отказ API становится исключением для проверки кода и причины. */
class ApiAuthTestRouter extends router {
	static function haltJson($text, $code = 500, $info = null) { throw new Exception($text, $code); }
}

/** Убеждаемся, что анонимный запрос запрещён с кодом повторной авторизации. */
function expectAuthDenied($controller, $action) {
	try {
		ApiAuthTestRouter::checkAuth($controller, $action);
	} catch (Exception $error) {
		if ($error->getCode() === 401 && $error->getMessage() === 'Требуется авторизация') return;
		throw $error;
	}
	throw new Exception('Анонимный доступ к ' . $controller . '/' . $action);
}

// Доступ к данным и изменениям запрещён даже при отсутствии объекта пользователя.
$USER = null;
expectAuthDenied('task', 'update');
$USER = new ApiAuthTestUser(false);
foreach (array(array('user', 'list'), array('user', 'info'), array('task', 'get'), array('task', 'update'), array('ticket', 'create'), array('stage', 'list')) as $route) {
	expectAuthDenied($route[0], $route[1]);
}

// Публичны только два точных маршрута; похожие имена не расширяют исключение.
ApiAuthTestRouter::checkAuth('user', 'login');
ApiAuthTestRouter::checkAuth('user', 'get');
expectAuthDenied('task', 'login');
expectAuthDenied('User', 'login');

// После штатного входа общий барьер не меняет права внутри контроллеров Bitrix.
$USER = new ApiAuthTestUser(true);
ApiAuthTestRouter::checkAuth('task', 'update');
ApiAuthTestRouter::checkAuth('user', 'list');
echo "OK: общий барьер API, публичные маршруты и авторизованная сессия\n";
