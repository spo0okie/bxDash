<?php
/** Штатный «Мой план» Bitrix; дополнительные настройки bxDash не меняют схему БД. */
class stages_provider_bitrix extends stages_provider {
	const OPTIONS_CATEGORY = 'bxdash_kanban';
	const OPTIONS_NAME = 'native_board';

	/** Явный bitrix на старом портале завершается понятной ошибкой. */
	public function __construct() { $this->install(); }

	/** Проверяет наличие API, не создавая таблиц и не подменяя хранилище при ошибке. */
	public function install() {
		if (!class_exists('Bitrix\\Tasks\\Kanban\\StagesTable')
			|| !class_exists('Bitrix\\Tasks\\Kanban\\TaskStageTable')) {
			throw new Exception('Штатный API канбана Bitrix недоступен');
		}
	}

	/** Чужую персональную доску может менять только администратор портала. */
	private function requireWrite($userId) {
		global $USER;
		$userId = static::checkUserId($userId);
		if (!is_object($USER) || ((int)$USER->GetID() !== $userId && !$USER->IsAdmin())) {
			throw new stages_exception('Изменять эту доску может её владелец или администратор');
		}
		return $userId;
	}

	/** Настройки стопок и привязок работ/заявок в пространстве имён bxDash. */
	private function options($userId) {
		$value = CUserOptions::GetOption(static::OPTIONS_CATEGORY, static::OPTIONS_NAME, array(), $userId);
		return is_array($value) ? $value : array();
	}

	/** Сохраняет дополнительные настройки и сообщает об ошибке записи. */
	private function saveOptions($userId, array $value) {
		if (!CUserOptions::SetOption(static::OPTIONS_CATEGORY, static::OPTIONS_NAME, $value, false, $userId)) {
			throw new Exception('Не удалось сохранить настройки канбана bxDash');
		}
	}

	/** Перечисляет пользователей с дополнительными настройками, не читая чужие категории. */
	private function optionUsers() {
		$rows = CUserOptions::GetList(array('ID' => 'ASC'), array(
			'CATEGORY' => static::OPTIONS_CATEGORY, 'NAME' => static::OPTIONS_NAME,
		));
		$ids = array();
		while ($row = $rows->Fetch()) if ((int)$row['USER_ID'] > 0) $ids[] = (int)$row['USER_ID'];
		return array_unique($ids);
	}

	/** Проверяет результат ORM: ошибки Bitrix передаются в JSON-ответ контроллера. */
	private function checked($result) {
		if (!$result || !$result->isSuccess()) {
			throw new Exception($result ? implode('; ', $result->getErrorMessages()) : 'Ошибка API стадий Bitrix');
		}
		return $result;
	}

	/** Выполняет связанные записи атомарно, включая перенос привязок перед удалением стадии. */
	private function transaction($callback) {
		$connection = \Bitrix\Main\Application::getConnection();
		$connection->startTransaction();
		try {
			$result = call_user_func($callback);
			$connection->commitTransaction();
			return $result;
		} catch (Exception $e) {
			$connection->rollbackTransaction();
			throw $e;
		} catch (Throwable $e) {
			$connection->rollbackTransaction();
			throw $e;
		}
	}

	/** Приводит строку штатной стадии к общему контракту frontend. */
	private function stageRow(array $row) {
		$options = $this->options((int)$row['ENTITY_ID']);
		$color = ltrim((string)$row['COLOR'], '#');
		return array(
			'ID' => (int)$row['ID'], 'USER_ID' => (int)$row['ENTITY_ID'],
			'TITLE' => (string)$row['TITLE'] !== '' ? (string)$row['TITLE'] : static::DEFAULT_TITLE,
			'SORT' => (int)$row['SORT'], 'COLOR' => $color !== '' ? '#'.$color : null,
			'IS_DEFAULT' => $row['SYSTEM_TYPE'] === \Bitrix\Tasks\Kanban\StagesTable::SYS_TYPE_NEW ? 'Y' : 'N',
			'STACKED' => in_array((int)$row['ID'], isset($options['stacked']) ? $options['stacked'] : array(), true) ? 'Y' : 'N',
		);
	}

	/** Читает только личные стадии U; P — временная шкала, G — проект. */
	public function getStage($id) {
		$rows = \Bitrix\Tasks\Kanban\StagesTable::getList(array('filter' => array(
			'=ID' => (int)$id, '=ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER,
		)));
		$row = $rows->fetch();
		return $row ? $this->stageRow($row) : null;
	}

	/** Возвращает существующую личную стадию или ошибку 404. */
	private function requireStage($id) {
		$stage = $this->getStage($id);
		if (!$stage) throw new stages_exception('Личный столбец не найден: '.(int)$id, 404);
		return $stage;
	}

	/** Читает личный план, при отсутствии стадий создаёт штатные колонки только владельцу/администратору. */
	public function getStages($userId) {
		$userId = static::checkUserId($userId);
		$rows = \Bitrix\Tasks\Kanban\StagesTable::getList(array(
			'filter' => array('=ENTITY_ID' => $userId, '=ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER),
			'order' => array('SORT' => 'ASC', 'ID' => 'ASC'),
		));
		$result = array();
		while ($row = $rows->fetch()) $result[] = $this->stageRow($row);
		if ($result) return $result;
		$this->requireWrite($userId);
		$mode = \Bitrix\Tasks\Kanban\StagesTable::getWorkMode();
		\Bitrix\Tasks\Kanban\StagesTable::setWorkMode(\Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER);
		try {
			$created = \Bitrix\Tasks\Kanban\StagesTable::getStages($userId);
		} catch (Exception $e) {
			\Bitrix\Tasks\Kanban\StagesTable::setWorkMode($mode);
			throw $e;
		} catch (Throwable $e) {
			\Bitrix\Tasks\Kanban\StagesTable::setWorkMode($mode);
			throw $e;
		}
		\Bitrix\Tasks\Kanban\StagesTable::setWorkMode($mode);
		if (!$created) throw new Exception('Bitrix не создал личные стадии пользователя '.$userId);
		foreach ($created as $row) $result[] = $this->stageRow($row);
		return $result;
	}

	/** Создаёт обычную стадию в штатном личном плане. */
	public function createStage($userId, $title, $color = null, $sort = null) {
		$userId = $this->requireWrite($userId);
		$title = static::checkTitle($title);
		$color = static::checkColor($color);
		$stages = $this->getStages($userId);
		if ($sort === null || $sort === '') {
			$sort = 0;
			foreach ($stages as $stage) $sort = max($sort, $stage['SORT']);
			$sort += static::SORT_STEP;
		}
		$result = \Bitrix\Tasks\Kanban\StagesTable::add(array(
			'ENTITY_ID' => $userId, 'ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER,
			'TITLE' => $title, 'SORT' => (int)$sort, 'COLOR' => $color === null ? '' : substr($color, 1),
		));
		return (int)$this->checked($result)->getId();
	}

	/** Меняет только название, цвет или порядок существующей личной стадии. */
	public function updateStage($id, array $fields) {
		$stage = $this->requireStage($id);
		$this->requireWrite($stage['USER_ID']);
		$data = array();
		if (array_key_exists('TITLE', $fields)) $data['TITLE'] = static::checkTitle($fields['TITLE']);
		if (array_key_exists('SORT', $fields)) $data['SORT'] = (int)$fields['SORT'];
		if (array_key_exists('COLOR', $fields)) {
			$color = static::checkColor($fields['COLOR']);
			$data['COLOR'] = $color === null ? '' : substr($color, 1);
		}
		if (!$data) throw new stages_exception('Нет данных для изменения столбца');
		$this->checked(\Bitrix\Tasks\Kanban\StagesTable::update($stage['ID'], $data));
	}

	/** Сохраняет порядок всех личных стадий и стопки bxDash без новых полей в штатной таблице. */
	public function reorderStages($userId, array $idsInOrder, $stackedIds = null) {
		$userId = $this->requireWrite($userId);
		$own = array();
		foreach ($this->getStages($userId) as $stage) $own[$stage['ID']] = $stage;
		$ids = static::checkIds($idsInOrder);
		if (!$ids) throw new stages_exception('Не передан порядок столбцов');
		foreach (array_merge($ids, $stackedIds === null ? array() : static::checkIds($stackedIds)) as $id) {
			if (!isset($own[$id])) throw new stages_exception('Столбец не принадлежит пользователю: '.$id);
		}
		$order = array_merge($ids, array_diff(array_keys($own), $ids));
		$self = $this;
		$this->transaction(function () use ($self, $userId, $order, $stackedIds) {
			foreach (array_values($order) as $index => $id) {
				$self->checked(\Bitrix\Tasks\Kanban\StagesTable::update($id, array('SORT' => ($index + 1) * self::SORT_STEP)));
			}
			if ($stackedIds !== null) {
				$options = $self->options($userId);
				$options['stacked'] = self::checkIds($stackedIds);
				$self->saveOptions($userId, $options);
			}
		});
	}

	/** Читает штатные привязки задач пачкой, а jobs/tickets — из настроек bxDash. */
	public function getItemStages($itemType, array $itemIds) {
		static::checkItemType($itemType);
		$ids = static::checkIds($itemIds);
		$result = array();
		if (!$ids) return $result;
		if ($itemType === 'task') {
			foreach (array_chunk($ids, 1000) as $chunk) {
				$rows = \Bitrix\Tasks\Kanban\TaskStageTable::getList(array(
					'select' => array('TASK_ID', 'STAGE_ID', 'USER_ID' => 'STAGE.ENTITY_ID'),
					'filter' => array('@TASK_ID' => $chunk, '=STAGE.ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER),
					'order' => array('ID' => 'ASC'),
				));
				while ($row = $rows->fetch()) $result[(int)$row['TASK_ID']][(int)$row['USER_ID']] = (int)$row['STAGE_ID'];
			}
		} else {
			$candidates = array();
			$stageIds = array();
			foreach ($this->optionUsers() as $userId) {
				$options = $this->options($userId);
				foreach ($ids as $id) {
					if (!empty($options[$itemType][$id])) {
						$stageId = (int)$options[$itemType][$id];
						$candidates[$id][$userId] = $stageId;
						$stageIds[$stageId] = $stageId;
					}
				}
			}
			// Проверяем существование и владельца стадий пачкой, а не запросом на карточку.
			$owners = array();
			foreach (array_chunk(array_values($stageIds), 1000) as $chunk) {
				$rows = \Bitrix\Tasks\Kanban\StagesTable::getList(array('filter' => array(
					'@ID' => $chunk, '=ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER,
				)));
				while ($row = $rows->fetch()) $owners[(int)$row['ID']] = (int)$row['ENTITY_ID'];
			}
			foreach ($candidates as $id => $map) {
				foreach ($map as $userId => $stageId) {
					if (isset($owners[$stageId]) && $owners[$stageId] === $userId) $result[$id][$userId] = $stageId;
				}
			}
		}
		return $result;
	}

	/** Переносит элемент только в личном плане указанного пользователя, сохраняя остальные планы. */
	public function setItemStage($itemType, $itemId, $userId, $stageId) {
		static::checkItemType($itemType);
		$userId = $this->requireWrite($userId);
		$itemId = (int)$itemId;
		if ($itemId <= 0) throw new stages_exception('Не указан элемент');
		$stages = $this->getStages($userId);
		$ids = array();
		foreach ($stages as $stage) $ids[] = $stage['ID'];
		if ($stageId === null || $stageId === '' || $stageId === 'null' || (int)$stageId === 0) {
			$stageId = $this->getDefaultStageId($userId);
		}
		$stageId = (int)$stageId;
		if (!in_array($stageId, $ids, true)) throw new stages_exception('Столбец не принадлежит пользователю');
		if ($itemType !== 'task') {
			$options = $this->options($userId);
			$options[$itemType][$itemId] = $stageId;
			$this->saveOptions($userId, $options);
			return;
		}
		global $USER;
		// ORM связей сам не проверяет доступ к задаче: проверяем его штатным TaskItem.
		$task = new CTaskItem($itemId, (int)$USER->GetID());
		$task->GetData();
		$self = $this;
		$this->transaction(function () use ($self, $itemId, $ids, $stageId) {
			$rows = \Bitrix\Tasks\Kanban\TaskStageTable::getList(array('filter' => array('=TASK_ID' => $itemId, '@STAGE_ID' => $ids)));
			while ($row = $rows->fetch()) $self->checked(\Bitrix\Tasks\Kanban\TaskStageTable::delete($row['ID']));
			$self->checked(\Bitrix\Tasks\Kanban\TaskStageTable::add(array('TASK_ID' => $itemId, 'STAGE_ID' => $stageId)));
		});
	}

	/** Удаляет стадию после атомарного переноса задач, работ и заявок. */
	public function deleteStage($id, $moveToId = null) {
		$stage = $this->requireStage($id);
		$userId = $this->requireWrite($stage['USER_ID']);
		if ($stage['IS_DEFAULT'] === 'Y') throw new stages_exception('Столбец по умолчанию удалить нельзя');
		$target = $moveToId ? $this->requireStage($moveToId) : $this->requireStage($this->getDefaultStageId($userId));
		if ($target['USER_ID'] !== $userId || $target['ID'] === $stage['ID']) throw new stages_exception('Некорректный столбец для переноса');
		$self = $this;
		return $this->transaction(function () use ($self, $stage, $target, $userId) {
			$rows = \Bitrix\Tasks\Kanban\TaskStageTable::getList(array('filter' => array('=STAGE_ID' => $stage['ID'])));
			while ($row = $rows->fetch()) {
				$exists = \Bitrix\Tasks\Kanban\TaskStageTable::getList(array('filter' => array('=TASK_ID' => $row['TASK_ID'], '=STAGE_ID' => $target['ID'])))->fetch();
				if ($exists) $self->checked(\Bitrix\Tasks\Kanban\TaskStageTable::delete($row['ID']));
				else $self->checked(\Bitrix\Tasks\Kanban\TaskStageTable::update($row['ID'], array('STAGE_ID' => $target['ID'])));
			}
			$options = $self->options($userId);
			foreach (array('job', 'ticket') as $type) {
				if (empty($options[$type])) continue;
				foreach ($options[$type] as $itemId => $stageId) {
					if ((int)$stageId === $stage['ID']) $options[$type][$itemId] = $target['ID'];
				}
			}
			// Нижний столбец удалённой верхушки стопки занимает её место.
			$next = false;
			foreach ($self->getStages($userId) as $other) {
				if ($next) {
					if ($stage['STACKED'] !== 'Y' && isset($options['stacked'])) $options['stacked'] = array_values(array_diff($options['stacked'], array($other['ID'])));
					break;
				}
				if ($other['ID'] === $stage['ID']) $next = true;
			}
			if (isset($options['stacked'])) $options['stacked'] = array_values(array_diff($options['stacked'], array($stage['ID'])));
			$self->saveOptions($userId, $options);
			// systemDelete вызывает штатные события ORM, не зависит от глобального work mode.
			$self->checked(\Bitrix\Tasks\Kanban\StagesTable::systemDelete($stage['ID']));
			return $target['ID'];
		});
	}

	/** Убирает привязки удалённого элемента, не затрагивая проектные стадии и спринты. */
	public function removeItem($itemType, $itemId) {
		static::checkItemType($itemType);
		if ($itemType === 'task') {
			// Не используем clearTask(): он затронул бы также стадии активных спринтов.
			$rows = \Bitrix\Tasks\Kanban\TaskStageTable::getList(array('filter' => array(
				'=TASK_ID' => (int)$itemId, '=STAGE.ENTITY_TYPE' => \Bitrix\Tasks\Kanban\StagesTable::WORK_MODE_USER,
			)));
			while ($row = $rows->fetch()) $this->checked(\Bitrix\Tasks\Kanban\TaskStageTable::delete($row['ID']));
			return;
		}
		foreach ($this->optionUsers() as $userId) {
			$options = $this->options($userId);
			if (isset($options[$itemType][$itemId])) {
				unset($options[$itemType][$itemId]);
				$this->saveOptions($userId, $options);
			}
		}
	}
}
