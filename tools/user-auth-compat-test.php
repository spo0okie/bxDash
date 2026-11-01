<?php
/** Проверяет ответ user/get с обоими API CUser без подключения к порталу. */
require_once __DIR__ . '/../back/app/ctl/controller_user.php';

/** Современный API не предоставляет GetSessionHash. */
class ModernCompatUser {
	function IsAuthorized() { return true; }
	function GetID() { return 5; }
	function GetLogin() { return 'test-user'; }
}

/** Старый API сохраняет прежнее поле hash в ответе. */
class LegacyCompatUser extends ModernCompatUser {
	function GetSessionHash() { return 'legacy-hash'; }
}

foreach (array(new ModernCompatUser(), new LegacyCompatUser()) as $USER) {
	ob_start();
	$controller = new controller_user();
	$controller->action_get();
	$result = json_decode(ob_get_clean(), true);
	$expectedHash = $USER instanceof LegacyCompatUser ? 'legacy-hash' : null;
	if (!$result || $result['auth'] !== true || $result['id'] !== 5
		|| !array_key_exists('hash', $result) || $result['hash'] !== $expectedHash) {
		throw new Exception('Нарушен контракт user/get для ' . get_class($USER));
	}
}
echo "OK: user/get совместим с CUser с GetSessionHash и без него\n";
