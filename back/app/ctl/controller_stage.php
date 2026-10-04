<?php
/*
 * Столбцы (стадии) персональной канбан-доски: список, создание, правка, удаление, порядок.
 *
 * Где именно хранятся стадии, контроллер не знает — всё через stages_provider.
 * См. plans/bucket_columns.md
 *
 *   GET  stage/list/{userId}
 *   POST stage/create        {user, title, color?, sort?}
 *   POST stage/update/{id}   {title?, color?, sort?}
 *   POST stage/delete/{id}   {moveTo?}
 *   POST stage/reorder       {user, ids:[...], stacked?:[...]}  — stacked: id столбцов, стоящих под предыдущим
 *   GET  stage/install
 */

if (!class_exists('stages_provider', false)) router::loadModel('stages_provider');

class controller_stage {
	// имя UNSET нельзя: на PHP 5 константа класса не может называться зарезервированным словом
	const NOT_SET = '##UNSET';

	/** Работать со стадиями может любой авторизованный пользователь портала */
	static private function requireAuth() {
		global $USER;
		if (!is_object($USER) || !$USER->IsAuthorized())
			router::haltJson('Требуется авторизация', 401);
	}

	/**
	 * Выполнить действие над провайдером; «так нельзя» отдаём с кодом из исключения (409/404).
	 * Прочие исключения ловит роутер и отдаёт 500.
	 */
	static private function run($callback) {
		static::requireAuth();
		try {
			$result = call_user_func($callback, stages_provider::instance());
		} catch (stages_exception $e) {
			router::haltJson($e->getMessage(), $e->httpCode);
		}
		echo json_encode($result, JSON_UNESCAPED_UNICODE);
	}

	/** Существует ли пользователь портала (чтобы не плодить стадии для несуществующих id) */
	static private function requireUser($userId) {
		$userId = (int)$userId;
		if ($userId <= 0) throw new stages_exception('Не указан пользователь');
		$rsUser = CUser::GetByID($userId);
		if (!$rsUser || !$rsUser->Fetch())
			throw new stages_exception('Пользователь ' . $userId . ' не найден', 404);
		return $userId;
	}

	public function action_list() {
		$userId = router::getRoute(3, 'user');
		static::run(function ($provider) use ($userId) {
			return $provider->getStages(static::requireUser($userId));
		});
	}

	public function action_create() {
		$userId = router::getRoute(null, 'user');
		$title = router::getRoute(null, 'title');
		$color = router::getRoute(null, 'color');
		$sort = router::getRoute(null, 'sort');
		static::run(function ($provider) use ($userId, $title, $color, $sort) {
			$id = $provider->createStage(static::requireUser($userId), $title, $color, $sort);
			return ['result' => 'ok', 'id' => $id, 'stage' => $provider->getStage($id)];
		});
	}

	public function action_update() {
		$id = (int)router::getRoute(3, 'id');
		$fields = [];
		foreach (['title' => 'TITLE', 'color' => 'COLOR', 'sort' => 'SORT'] as $param => $field) {
			$value = router::getRoute(null, $param, static::NOT_SET);
			if ($value !== static::NOT_SET) $fields[$field] = $value;
		}
		static::run(function ($provider) use ($id, $fields) {
			$provider->updateStage($id, $fields);
			return ['result' => 'ok', 'id' => $id, 'stage' => $provider->getStage($id)];
		});
	}

	public function action_delete() {
		$id = (int)router::getRoute(3, 'id');
		$moveTo = router::getRoute(null, 'moveTo');
		static::run(function ($provider) use ($id, $moveTo) {
			$target = $provider->deleteStage($id, $moveTo);
			return ['result' => 'ok', 'id' => $id, 'movedTo' => $target];
		});
	}

	public function action_reorder() {
		$userId = router::getRoute(null, 'user');
		$ids = router::getRoute(null, 'ids', []);
		if (is_string($ids)) $ids = explode(',', $ids);
		// stacked не передан — раскладку по стопкам не трогаем; передан (даже пустой) — переписываем
		$stacked = router::getRoute(null, 'stacked', static::NOT_SET);
		if ($stacked === static::NOT_SET) $stacked = null;
		elseif (is_string($stacked)) $stacked = ($stacked === '') ? [] : explode(',', $stacked);
		else $stacked = (array)$stacked;
		static::run(function ($provider) use ($userId, $ids, $stacked) {
			$userId = static::requireUser($userId);
			$provider->reorderStages($userId, (array)$ids, $stacked);
			return ['result' => 'ok', 'stages' => $provider->getStages($userId)];
		});
	}

	/** Создать таблицы хранилища. Идемпотентно, вызывается один раз при выкладке. */
	public function action_install() {
		static::run(function ($provider) {
			$provider->install();
			return ['result' => 'ok'];
		});
	}
}
