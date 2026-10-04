<?php
/*
 * Провайдер стадий на собственных таблицах bxdash_stage / bxdash_item_stage.
 * Используется на порталах, где нет штатных b_tasks_stages (старый Битрикс).
 *
 * Привязка к стадии по умолчанию хранится как ОТСУТСТВИЕ строки в bxdash_item_stage
 * (так же устроен «Мой план» в Битрикс24).
 */

if (!class_exists('stages_provider', false)) router::loadModel('stages_provider');

class stages_provider_table extends stages_provider {
	const T_STAGE = 'bxdash_stage';
	const T_ITEM = 'bxdash_item_stage';

	/** Уже пробовали создать таблицы в этом запросе (чтобы не зациклиться) */
	private $installTried = false;

	/**
	 * Выполнить запрос; ошибку БД превращаем в исключение (роутер отдаст его фронту JSON'ом).
	 *
	 * Привязки читаются при каждой загрузке задач, поэтому забытый после выкладки stage/install
	 * ронял бы всю доску. При первой ошибке один раз создаём таблицы (CREATE IF NOT EXISTS)
	 * и повторяем запрос; если дело было не в них — исключение уйдёт наверх как обычно.
	 */
	private function query($sql) {
		global $DB;
		$res = $DB->Query($sql, true);
		if ($res === false && !$this->installTried) {
			$error = $DB->db_Error;
			$this->installTried = true;
			try {
				$this->install();
			} catch (Exception $e) {
				throw new Exception('Ошибка БД (стадии): ' . $error);
			}
			$res = $DB->Query($sql, true);
		}
		if ($res === false)
			throw new Exception('Ошибка БД (стадии): ' . $DB->db_Error);
		return $res;
	}

	private function fetchAll($sql) {
		$res = $this->query($sql);
		$rows = [];
		while ($row = $res->Fetch()) $rows[] = $row;
		return $rows;
	}

	private function quote($value) {
		global $DB;
		return "'" . $DB->ForSql($value) . "'";
	}

	static private function stageRow($row) {
		return [
			'ID' => (int)$row['ID'],
			'USER_ID' => (int)$row['USER_ID'],
			'TITLE' => (string)$row['TITLE'],
			'SORT' => (int)$row['SORT'],
			'COLOR' => ($row['COLOR'] === null || $row['COLOR'] === '') ? null : (string)$row['COLOR'],
			'IS_DEFAULT' => $row['IS_DEFAULT'] === 'Y' ? 'Y' : 'N',
			'STACKED' => (isset($row['STACKED']) && $row['STACKED'] === 'Y') ? 'Y' : 'N',
		];
	}

	public function install() {
		$this->query(
			"CREATE TABLE IF NOT EXISTS " . static::T_STAGE . " (
				ID INT NOT NULL AUTO_INCREMENT,
				USER_ID INT NOT NULL,
				TITLE VARCHAR(255) NOT NULL,
				SORT INT NOT NULL DEFAULT 100,
				COLOR VARCHAR(7) NULL,
				IS_DEFAULT CHAR(1) NOT NULL DEFAULT 'N',
				STACKED CHAR(1) NOT NULL DEFAULT 'N',
				PRIMARY KEY (ID),
				INDEX ix_bxdash_stage_user (USER_ID, SORT)
			)"
		);
		$this->query(
			"CREATE TABLE IF NOT EXISTS " . static::T_ITEM . " (
				ITEM_TYPE VARCHAR(16) NOT NULL,
				ITEM_ID INT NOT NULL,
				USER_ID INT NOT NULL,
				STAGE_ID INT NOT NULL,
				PRIMARY KEY (ITEM_TYPE, ITEM_ID, USER_ID),
				INDEX ix_bxdash_item_stage_stage (STAGE_ID)
			)"
		);

		// таблица могла быть создана до появления стопок — доращиваем колонку
		$res = $this->query("SHOW COLUMNS FROM " . static::T_STAGE . " LIKE 'STACKED'");
		if (!$res->Fetch())
			$this->query("ALTER TABLE " . static::T_STAGE . " ADD STACKED CHAR(1) NOT NULL DEFAULT 'N'");
	}

	private function selectStages($userId) {
		$rows = $this->fetchAll(
			"SELECT ID, USER_ID, TITLE, SORT, COLOR, IS_DEFAULT, STACKED FROM " . static::T_STAGE .
			" WHERE USER_ID=" . (int)$userId . " ORDER BY SORT ASC, ID ASC"
		);
		$stages = [];
		foreach ($rows as $row) $stages[] = static::stageRow($row);
		return $stages;
	}

	public function getStages($userId) {
		$userId = static::checkUserId($userId);
		$stages = $this->selectStages($userId);

		if (!count($stages)) {
			$this->query(
				"INSERT INTO " . static::T_STAGE . " (USER_ID, TITLE, SORT, IS_DEFAULT) VALUES (" .
				$userId . ", " . $this->quote(static::DEFAULT_TITLE) . ", " . static::SORT_STEP . ", 'Y')"
			);
			$stages = $this->selectStages($userId);
		}

		// Стадия по умолчанию должна быть ровно одна. Нарушить это могут два одновременных
		// первых обращения (обе вставят «Входящие») или ручная правка таблицы — чиним на месте.
		$defaults = [];
		foreach ($stages as $stage)
			if ($stage['IS_DEFAULT'] === 'Y') $defaults[] = $stage['ID'];

		if (count($defaults) > 1) {
			sort($defaults);
			$keep = array_shift($defaults);
			$extra = implode(',', $defaults);
			// привязок к стадии по умолчанию не бывает, но на всякий случай снимаем
			$this->query("DELETE FROM " . static::T_ITEM . " WHERE STAGE_ID IN (" . $extra . ")");
			// удаляем только дубли-пустышки с дефолтным названием, остальные просто разжалуем
			$this->query(
				"DELETE FROM " . static::T_STAGE . " WHERE ID IN (" . $extra . ") AND TITLE=" .
				$this->quote(static::DEFAULT_TITLE)
			);
			$this->query("UPDATE " . static::T_STAGE . " SET IS_DEFAULT='N' WHERE ID IN (" . $extra . ")");
			$stages = $this->selectStages($userId);
		} elseif (count($defaults) === 0) {
			$this->query("UPDATE " . static::T_STAGE . " SET IS_DEFAULT='Y' WHERE ID=" . $stages[0]['ID']);
			$this->query("DELETE FROM " . static::T_ITEM . " WHERE STAGE_ID=" . $stages[0]['ID']);
			$stages = $this->selectStages($userId);
		}

		return $stages;
	}

	public function getStage($id) {
		$rows = $this->fetchAll(
			"SELECT ID, USER_ID, TITLE, SORT, COLOR, IS_DEFAULT, STACKED FROM " . static::T_STAGE .
			" WHERE ID=" . (int)$id
		);
		return count($rows) ? static::stageRow($rows[0]) : null;
	}

	/** Стадия по id или исключение 404 */
	private function requireStage($id) {
		$stage = $this->getStage($id);
		if (!$stage) throw new stages_exception('Столбец ' . (int)$id . ' не найден', 404);
		return $stage;
	}

	public function createStage($userId, $title, $color = null, $sort = null) {
		global $DB;
		$userId = static::checkUserId($userId);
		$title = static::checkTitle($title);
		$color = static::checkColor($color);

		// гарантируем, что стадия по умолчанию уже есть, и заодно узнаём максимальный SORT
		$stages = $this->getStages($userId);
		if ($sort === null || $sort === '') {
			$sort = 0;
			foreach ($stages as $stage) $sort = max($sort, $stage['SORT']);
			$sort += static::SORT_STEP;
		}

		$this->query(
			"INSERT INTO " . static::T_STAGE . " (USER_ID, TITLE, SORT, COLOR, IS_DEFAULT) VALUES (" .
			$userId . ", " . $this->quote($title) . ", " . (int)$sort . ", " .
			($color === null ? "NULL" : $this->quote($color)) . ", 'N')"
		);
		return (int)$DB->LastID();
	}

	public function updateStage($id, array $fields) {
		$stage = $this->requireStage($id);
		$set = [];

		if (array_key_exists('TITLE', $fields))
			$set[] = "TITLE=" . $this->quote(static::checkTitle($fields['TITLE']));

		if (array_key_exists('COLOR', $fields)) {
			$color = static::checkColor($fields['COLOR']);
			$set[] = "COLOR=" . ($color === null ? "NULL" : $this->quote($color));
		}

		if (array_key_exists('SORT', $fields))
			$set[] = "SORT=" . (int)$fields['SORT'];

		if (!count($set)) throw new stages_exception('Нет данных для изменения столбца');

		$this->query("UPDATE " . static::T_STAGE . " SET " . implode(', ', $set) . " WHERE ID=" . $stage['ID']);
	}

	public function deleteStage($id, $moveToId = null) {
		$stage = $this->requireStage($id);
		if ($stage['IS_DEFAULT'] === 'Y')
			throw new stages_exception('Столбец по умолчанию удалить нельзя');

		$defaultId = $this->getDefaultStageId($stage['USER_ID']);

		if ($moveToId === null || $moveToId === '' || (int)$moveToId === 0) {
			$target = $defaultId;
		} else {
			$targetStage = $this->requireStage($moveToId);
			if ($targetStage['ID'] === $stage['ID'])
				throw new stages_exception('Нельзя перенести задачи в удаляемый столбец');
			if ($targetStage['USER_ID'] !== $stage['USER_ID'])
				throw new stages_exception('Столбец для переноса принадлежит другому пользователю');
			$target = $targetStage['ID'];
		}

		if ($target === $defaultId)
			$this->query("DELETE FROM " . static::T_ITEM . " WHERE STAGE_ID=" . $stage['ID']);
		else
			$this->query("UPDATE " . static::T_ITEM . " SET STAGE_ID=" . $target . " WHERE STAGE_ID=" . $stage['ID']);

		// если удаляем верхний столбец стопки, следующий за ним занимает его место,
		// а не прилипает к стопке слева
		if ($stage['STACKED'] !== 'Y') {
			$next = null;
			$found = false;
			foreach ($this->getStages($stage['USER_ID']) as $other) {
				if ($found) { $next = $other; break; }
				if ($other['ID'] === $stage['ID']) $found = true;
			}
			if ($next && $next['STACKED'] === 'Y')
				$this->query("UPDATE " . static::T_STAGE . " SET STACKED='N' WHERE ID=" . $next['ID']);
		}

		$this->query("DELETE FROM " . static::T_STAGE . " WHERE ID=" . $stage['ID']);
		return $target;
	}

	public function reorderStages($userId, array $idsInOrder, $stackedIds = null) {
		$userId = static::checkUserId($userId);
		$ids = static::checkIds($idsInOrder);
		if (!count($ids)) throw new stages_exception('Не передан порядок столбцов');

		$own = [];
		foreach ($this->getStages($userId) as $stage) $own[$stage['ID']] = true;
		foreach ($ids as $id)
			if (!isset($own[$id]))
				throw new stages_exception('Столбец ' . $id . ' не принадлежит пользователю ' . $userId);

		// не перечисленные стадии сохраняют взаимный порядок и уходят в конец
		$sort = 0;
		foreach ($ids as $id) {
			$sort += static::SORT_STEP;
			$this->query("UPDATE " . static::T_STAGE . " SET SORT=" . $sort . " WHERE ID=" . $id);
			unset($own[$id]);
		}
		foreach (array_keys($own) as $id) {
			$sort += static::SORT_STEP;
			$this->query("UPDATE " . static::T_STAGE . " SET SORT=" . $sort . " WHERE ID=" . (int)$id);
		}

		// раскладка по стопкам: признак переписываем у всех стадий пользователя разом
		if ($stackedIds !== null) {
			$stacked = static::checkIds($stackedIds);
			$this->query("UPDATE " . static::T_STAGE . " SET STACKED='N' WHERE USER_ID=" . $userId);
			if (count($stacked))
				$this->query(
					"UPDATE " . static::T_STAGE . " SET STACKED='Y' WHERE USER_ID=" . $userId .
					" AND ID IN (" . implode(',', $stacked) . ")"
				);
		}
	}

	public function getItemStages($itemType, array $itemIds) {
		$itemType = static::checkItemType($itemType);
		$ids = static::checkIds($itemIds);
		$result = [];

		foreach (array_chunk($ids, 1000) as $chunk) {
			$rows = $this->fetchAll(
				"SELECT ITEM_ID, USER_ID, STAGE_ID FROM " . static::T_ITEM .
				" WHERE ITEM_TYPE=" . $this->quote($itemType) .
				" AND ITEM_ID IN (" . implode(',', $chunk) . ")"
			);
			foreach ($rows as $row)
				$result[(int)$row['ITEM_ID']][(int)$row['USER_ID']] = (int)$row['STAGE_ID'];
		}
		return $result;
	}

	public function setItemStage($itemType, $itemId, $userId, $stageId) {
		$itemType = static::checkItemType($itemType);
		$userId = static::checkUserId($userId);
		$itemId = (int)$itemId;
		if ($itemId <= 0) throw new stages_exception('Не указан элемент');

		$where = " WHERE ITEM_TYPE=" . $this->quote($itemType) . " AND ITEM_ID=" . $itemId . " AND USER_ID=" . $userId;

		$toDefault = ($stageId === null || $stageId === '' || $stageId === 'null' || (int)$stageId === 0);
		if (!$toDefault) {
			$stage = $this->requireStage($stageId);
			if ($stage['USER_ID'] !== $userId)
				throw new stages_exception('Столбец ' . $stage['ID'] . ' не принадлежит пользователю ' . $userId);
			$toDefault = ($stage['IS_DEFAULT'] === 'Y');
		}

		if ($toDefault) {
			$this->query("DELETE FROM " . static::T_ITEM . $where);
			return;
		}

		$this->query(
			"INSERT INTO " . static::T_ITEM . " (ITEM_TYPE, ITEM_ID, USER_ID, STAGE_ID) VALUES (" .
			$this->quote($itemType) . ", " . $itemId . ", " . $userId . ", " . $stage['ID'] . ")" .
			" ON DUPLICATE KEY UPDATE STAGE_ID=" . $stage['ID']
		);
	}

	public function removeItem($itemType, $itemId) {
		$itemType = static::checkItemType($itemType);
		$this->query(
			"DELETE FROM " . static::T_ITEM .
			" WHERE ITEM_TYPE=" . $this->quote($itemType) . " AND ITEM_ID=" . (int)$itemId
		);
	}
}
