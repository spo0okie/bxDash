<?php
router::loadModel('ticket_hold_intervals');
router::loadModel('ticket_statistics_rules');
router::loadModel('ticket_statistics');

/** Статистика техподдержки; таблицы и миграции не используются. */
class controller_ticket_statistics {
	/** Проверить ISO-дату без нормализации невозможных дней. */
	static public function validDate($value) {
		if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
		$parts = explode('-', $value);
		return checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0]);
	}

	/** Выдать строки периода и параметры расчёта для модального отчёта. */
	public function action_get() {
		global $USER;
		$rules = ticket_statistics_rules::get();
		if (!$USER || !$USER->IsAuthorized() || (!$USER->IsAdmin()
			&& !ticket_statistics::inSupport($USER->GetID(), $rules['supportGroup']))) {
			router::haltJson('Статистика доступна сотрудникам техподдержки и администраторам', 409);
		}
		$from = router::getRoute(null, 'from');
		$to = router::getRoute(null, 'to');
		$mode = router::getRoute(null, 'mode', 'created');
		$userIds = router::getIds(null, 'users');
		if (!$userIds) router::haltJson('В дашборде не загружены сотрудники для отчёта', 409);
		if (!self::validDate($from) || !self::validDate($to) || $from > $to
			|| strtotime($to) - strtotime($from) > 366 * 86400 || !in_array($mode, ['created', 'closed'])) {
			router::haltJson('Укажите корректный период не более года и способ отбора заявок', 409);
		}
		$fromDate = date('d.m.Y 00:00:00', strtotime($from));
		$toDate = date('d.m.Y 23:59:59', strtotime($to));
		echo json_encode([
			'rows' => ticket_statistics::load($fromDate, $toDate, $mode, $rules, $userIds),
			'asOf' => date('d.m.Y H:i:s'), 'periodEnd' => $toDate,
			'overdueDays' => $rules['overdueDays'],
		], JSON_UNESCAPED_UNICODE);
	}
}
