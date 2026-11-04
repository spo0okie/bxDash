<?php
/*
 * Провайдер стадий (столбцов персональной канбан-доски).
 *
 * Это единственное место, которое знает, ГДЕ хранятся столбцы и привязки элементов к ним.
 * Контроллеры работают только через этот интерфейс. Режим задаётся в conf.php:
 *
 *     $stagesProvider = 'auto';   // штатный API при наличии, иначе старое хранилище table
 *     $stagesProvider = 'bitrix'; // явно штатные личные стадии U и TaskStageTable
 *     $stagesProvider = 'table';  // явно прежние таблицы bxdash_*
 *
 * Модель повторяет «Мой план» Битрикс24: стадии принадлежат пользователю, элемент лежит
 * в стадии в плане конкретного пользователя. Отсутствие привязки = стадия по умолчанию.
 *
 * См. plans/bucket_columns.md
 */

/**
 * Ошибка уровня «так нельзя» (не найдено, чужая стадия, удаление стадии по умолчанию).
 * Код ответа по умолчанию 409: 401/403 фронт принимает за слёт авторизации.
 */
class stages_exception extends Exception {
	public $httpCode;

	public function __construct($message, $httpCode = 409) {
		parent::__construct($message);
		$this->httpCode = $httpCode;
	}
}

abstract class stages_provider {
	/** Название стадии по умолчанию, создаваемой пользователю при первом обращении */
	const DEFAULT_TITLE = 'Входящие';
	const TITLE_MAX = 255;
	const SORT_STEP = 100;

	/** Типы элементов, которые можно раскладывать по стадиям */
	static public $itemTypes = ['task', 'job', 'ticket'];

	private static $instance = null;

	/**
	 * Провайдер из conf.php ($stagesProvider): auto выбирает штатный API при его наличии.
	 * @return stages_provider
	 */
	static public function instance() {
		if (self::$instance !== null) return self::$instance;

		$name = isset($GLOBALS['stagesProvider']) ? (string)$GLOBALS['stagesProvider'] : 'auto';
		if ($name === 'auto') {
			// Проверяем API, а не номер версии портала. Ошибка штатного API не включает fallback.
			$name = class_exists('Bitrix\\Tasks\\Kanban\\StagesTable')
				&& class_exists('Bitrix\\Tasks\\Kanban\\TaskStageTable') ? 'bitrix' : 'table';
		}
		if (!preg_match('/^[a-z0-9_]+$/', $name))
			throw new Exception('Некорректное имя провайдера стадий: ' . $name);

		$class = 'stages_provider_' . $name;
		if (!class_exists($class, false)) router::loadModel($class);
		if (!class_exists($class, false))
			throw new Exception('Провайдер стадий не найден: ' . $class);

		return self::$instance = new $class();
	}

	// ==================== Интерфейс ====================

	/** Подготовить хранилище: table создаёт свои таблицы, bitrix только проверяет API. */
	abstract public function install();

	/**
	 * Стадии пользователя по возрастанию SORT. Если стадий нет — создаёт стадию по умолчанию.
	 * @return array[] строки вида [ID, USER_ID, TITLE, SORT, COLOR, IS_DEFAULT, STACKED]
	 *   STACKED = 'Y' — столбец стоит на доске ПОД предыдущим (по SORT), в одной вертикальной стопке с ним;
	 *   'N' — начинает новую стопку. У первого столбца признак не имеет смысла.
	 */
	abstract public function getStages($userId);

	/** Одна стадия по id или null */
	abstract public function getStage($id);

	/** @return int id созданной стадии */
	abstract public function createStage($userId, $title, $color = null, $sort = null);

	/** $fields: TITLE, COLOR, SORT — любое подмножество */
	abstract public function updateStage($id, array $fields);

	/**
	 * Удалить стадию, перевязав её элементы на $moveToId (null — на стадию по умолчанию).
	 * @return int id стадии, в которую перенесены элементы
	 */
	abstract public function deleteStage($id, $moveToId = null);

	/**
	 * Переписать порядок стадий пользователя: $idsInOrder — id слева направо (внутри стопки — сверху вниз).
	 * $stackedIds — id стадий, стоящих под предыдущей; если передан (в т.ч. пустой массив), признак STACKED
	 * переписывается у ВСЕХ стадий пользователя; null — признак не трогаем.
	 */
	abstract public function reorderStages($userId, array $idsInOrder, $stackedIds = null);

	/**
	 * Привязки пачки элементов одного типа.
	 * @return array [itemId => [userId => stageId, ...], ...] — только элементы с явной привязкой
	 */
	abstract public function getItemStages($itemType, array $itemIds);

	/** Привязать элемент к стадии в плане пользователя; $stageId === null — снять привязку */
	abstract public function setItemStage($itemType, $itemId, $userId, $stageId);

	/** Убрать все привязки элемента (при его удалении) */
	abstract public function removeItem($itemType, $itemId);

	// ==================== Связка с контроллерами элементов ====================

	/** Признак «параметр не передан» (null — осмысленное значение: снять привязку) */
	const NOT_SET = '##UNSET';

	/**
	 * Дописать каждому элементу списка поле STAGES — {userId: stageId} его явных привязок.
	 * Элемент без привязок получает пустой объект (у всех он в стадии по умолчанию).
	 * Привязки всей пачки читаются одним запросом.
	 * @param string $itemType task|job|ticket
	 * @param array $items список элементов (массивов с ключом ID), ключи списка любые
	 */
	static public function attach($itemType, array &$items) {
		$ids = [];
		foreach ($items as $item)
			if (is_array($item) && isset($item['ID'])) $ids[] = (int)$item['ID'];

		$map = count($ids) ? static::instance()->getItemStages($itemType, $ids) : [];

		foreach ($items as $key => $item) {
			if (!is_array($item)) continue;
			$id = isset($item['ID']) ? (int)$item['ID'] : 0;
			// непустой массив с ключами-userId json_encode отдаёт объектом; пустой — нужен явный объект
			$items[$key]['STAGES'] = isset($map[$id]) ? $map[$id] : new stdClass();
		}
	}

	/** То же, что attach(), но возвращает список — удобно прямо в json_encode() */
	static public function attached($itemType, array $items) {
		static::attach($itemType, $items);
		return $items;
	}

	/** Передан ли в запросе параметр stage */
	static public function requested() {
		return router::getRoute(null, 'stage', static::NOT_SET) !== static::NOT_SET;
	}

	/**
	 * Применить привязку из параметров запроса: stage (id стадии или null) и stageUser (владелец доски).
	 * Если stage не передан — ничего не делает. Ошибки «так нельзя» завершают запрос с кодом 409/404.
	 * @return bool была ли привязка изменена
	 */
	static public function applyRequest($itemType, $itemId) {
		$stage = router::getRoute(null, 'stage', static::NOT_SET);
		if ($stage === static::NOT_SET) return false;
		$stageUser = router::getRoute(null, 'stageUser');
		try {
			static::instance()->setItemStage($itemType, $itemId, $stageUser, $stage);
		} catch (stages_exception $e) {
			router::haltJson($e->getMessage(), $e->httpCode);
		}
		return true;
	}

	// ==================== Общие помощники ====================

	/** @return int id стадии по умолчанию (создаёт её при необходимости) */
	public function getDefaultStageId($userId) {
		foreach ($this->getStages($userId) as $stage)
			if ($stage['IS_DEFAULT'] === 'Y') return $stage['ID'];
		throw new Exception('У пользователя ' . (int)$userId . ' нет стадии по умолчанию');
	}

	static public function checkUserId($userId) {
		$userId = (int)$userId;
		if ($userId <= 0) throw new stages_exception('Не указан пользователь');
		return $userId;
	}

	static public function checkItemType($itemType) {
		if (!in_array($itemType, static::$itemTypes, true))
			throw new stages_exception('Неизвестный тип элемента: ' . $itemType);
		return $itemType;
	}

	static public function checkTitle($title) {
		$title = trim((string)$title);
		if ($title === '') throw new stages_exception('Название столбца не может быть пустым');
		if (function_exists('mb_substr')) $title = mb_substr($title, 0, static::TITLE_MAX, 'UTF-8');
		return $title;
	}

	/** @return string|null цвет вида #rrggbb либо null (без цвета) */
	static public function checkColor($color) {
		if ($color === null) return null;
		$color = trim((string)$color);
		if ($color === '') return null;
		if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color))
			throw new stages_exception('Цвет должен быть в формате #rrggbb');
		return strtolower($color);
	}

	/** @return int[] положительные уникальные id с сохранением порядка */
	static public function checkIds($ids) {
		$result = [];
		foreach ((array)$ids as $id) {
			$id = (int)$id;
			if ($id > 0) $result[$id] = $id;
		}
		return array_values($result);
	}
}
