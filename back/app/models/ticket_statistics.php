<?php

/** Подготовка строк статистики; календарные расчёты выполняет общий ScheduleStore на фронте. */
class ticket_statistics {
	private static $groups = [];

	/** Проверить членство пользователя в группе, кешируя справочник в пределах запроса. */
	static public function inSupport($userId, $groupId) {
		$userId = (int)$userId;
		if (!$userId) return false;
		if (!isset(self::$groups[$userId])) self::$groups[$userId] = CUser::GetUserGroup($userId);
		return in_array($groupId, self::$groups[$userId]);
	}

	/** Причина исключения: точные слова TEST/ТЕСТ не отсекают «тестирование» и latest. */
	static public function exclusion(array $ticket, array $rules) {
		if (in_array((int)$ticket['CATEGORY_ID'], $rules['excludedCategories'])) return 'Запрос на изменение';
		if (in_array((int)$ticket['STATUS_ID'], $rules['excludedStatuses'])) return 'Создана задача';
		if (preg_match('/(?<![\p{L}\p{N}_])(тест|test)(?![\p{L}\p{N}_])/iu', $ticket['TITLE'])) return 'Тестовая заявка';
		if (in_array((int)$ticket['ID'], $rules['excludedIds'])) return 'Ручной список исключений отчёта';
		if (self::inSupport($ticket['CREATED_USER_ID'], $rules['supportGroup'])
			&& self::inSupport($ticket['OWNER_USER_ID'], $rules['supportGroup'])) return 'Заявка от техподдержки';
		return null;
	}

	/** Дата завершения: штатное закрытие или решение, которое ожидает подтверждения пользователя. */
	static public function closeDate(array $ticket, array $rules) {
		if (!empty($ticket['DATE_CLOSE'])) return $ticket['DATE_CLOSE'];
		if ($ticket['HOLD_ON'] !== 'Y' && in_array((int)$ticket['STATUS_ID'], $rules['resolvedStatuses'])
			&& $ticket['LAST_MESSAGE_BY_SUPPORT_TEAM'] === 'Y') return $ticket['LAST_MESSAGE_DATE'];
		return null;
	}

	/** Загрузить кандидатов и их историю; в режиме закрытия учитывать также решённые заявки. */
	static public function load($from, $to, $mode, array $rules, array $userIds) {
		$filters = [];
		foreach (array_unique(array_map('intval', $userIds)) as $userId) {
			// Числовой фильтр старого Bitrix не поддерживает «1|2»: запрашиваем каждого сотрудника отдельно.
			$base = ['RESPONSIBLE_ID' => $userId, 'RESPONSIBLE_ID_EXACT_MATCH' => 'Y'];
			if ($mode === 'created') {
				$filters[] = array_merge($base, ['DATE_CREATE_1' => $from, 'DATE_CREATE_2' => $to]);
			} else {
				$filters[] = array_merge($base, ['DATE_CLOSE_1' => $from, 'DATE_CLOSE_2' => $to]);
				// Статусы также числовые: объединяем результаты отдельных выборок по ID заявки.
				foreach ($rules['resolvedStatuses'] as $statusId) {
					$filters[] = array_merge($base, ['STATUS_ID' => (int)$statusId,
						'STATUS_ID_EXACT_MATCH' => 'Y', 'DATE_TIMESTAMP_1' => $from]);
				}
			}
		}
		$tickets = [];
		foreach ($filters as $filter) {
			$by = 's_id';
			$order = 'asc';
			$isFiltered = false;
			$result = CTicket::GetList($by, $order, $filter, $isFiltered, 'N');
			if (!$result) throw new Exception('Не удалось загрузить заявки для статистики');
			while ($ticket = $result->Fetch()) {
				// Проверяем область и после API-фильтра, чтобы чужая строка не попала в итог.
				if ((int)$ticket['RESPONSIBLE_USER_ID'] !== $filter['RESPONSIBLE_ID']) continue;
				$closeDate = self::closeDate($ticket, $rules);
				if ($mode === 'closed' && (!$closeDate || strtotime($closeDate) < strtotime($from)
					|| strtotime($closeDate) > strtotime($to))) continue;
				$tickets[(int)$ticket['ID']] = $ticket;
			}
		}
		$rows = [];
		foreach ($tickets as $ticket) {
			$reason = self::exclusion($ticket, $rules);
			$rows[] = [
				'ID' => (int)$ticket['ID'], 'TITLE' => $ticket['TITLE'],
				'RESPONSIBLE_USER_ID' => (int)$ticket['RESPONSIBLE_USER_ID'],
				'RESPONSIBLE_NAME' => $ticket['RESPONSIBLE_NAME'],
				'DATE_CREATE' => $ticket['DATE_CREATE'],
				'REPORT_CLOSE_DATE' => self::closeDate($ticket, $rules),
				'HOLD_INTERVALS' => $reason ? [] : ticket_hold_intervals::load($ticket['ID']),
				'EXCLUSION_REASON' => $reason,
			];
		}
		return $rows;
	}
}
