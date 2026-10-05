<?php
/*
 * нужен для того чтобы пользователь мог проверить что битрикс доступен
 */

class controller_user {
	const MSG_OK='OK';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_JOB_ID='NO_JOB_ID_SET';

	static public $fieldsMap = [
		'auth',
		'id',
		'login',
		'error',
		'hash',
	];

	public $error=[];

	function action_get() {
		global $USER;
		$status = new stdClass();
		$status->auth=$USER->IsAuthorized();
		$status->id=$USER->GetID();
		$status->login=$USER->GetLogin();
		$status->error=$this->error;
		$status->hash=$USER->GetSessionHash();
		echo json_encode($status,JSON_UNESCAPED_UNICODE);
	}

	function action_login() {
		if (!($user=router::getRoute(null,'user'))) router::haltJson('no user');
		if (!($password=router::getRoute(null,'password'))) router::haltJson('no password');
		global $USER;
		$this->error=$USER->Login($user,$password,'Y');
		$this->action_get();
	}

	/**
	 * Возвращает список активных пользователей битрикса
	 * Используется для выбора автора при создании заявки
	 */
	function action_list() {
		$rsUsers = CUser::GetList(
			($by="id"),
			($order="asc"),
			["ACTIVE" => "Y"]
		);
		$users = [];
		while ($arUser = $rsUsers->GetNext()) {
			$users[] = [
				'id' => (int)$arUser['ID'],
				'name' => trim($arUser['NAME'] . ' ' . $arUser['LAST_NAME']),
				'login' => $arUser['LOGIN'],
				'email' => $arUser['EMAIL'],
			];
		}
		echo json_encode($users, JSON_UNESCAPED_UNICODE);
	}

	/**
	 * Возвращает логин и имя пользователя битрикса по его ID: user/info/<id>
	 * Используется, чтобы по ID из ссылки на профиль найти сотрудника в Inventory
	 */
	function action_info() {
		$id = (int)router::getRoute(3, 'id');
		if ($id <= 0) router::haltJson('Не указан ID пользователя', 400);
		$arUser = CUser::GetByID($id)->Fetch();
		if (!$arUser) router::haltJson('Пользователь '.$id.' не найден', 404);
		echo json_encode([
			'id' => (int)$arUser['ID'],
			'name' => trim($arUser['NAME'] . ' ' . $arUser['LAST_NAME']),
			'login' => $arUser['LOGIN'],
		], JSON_UNESCAPED_UNICODE);
	}

}



?>
