<?php

/** История отложенности из сообщений Bitrix; даты остаются в формате API (МСК). */
class ticket_hold_intervals {
	/** Получить интервалы одной заявки в порядке номеров сообщений. */
	static public function load($ticketId) {
		$by = 's_number';
		$order = 'asc';
		$isFiltered = false;
		$result = CTicket::GetMessageList($by, $order, [
			'TICKET_ID' => (int)$ticketId,
			'TICKET_ID_EXACT_MATCH' => 'Y'
		], $isFiltered, 'N');
		if (!$result) throw new Exception('Не удалось загрузить историю отложенности заявки ' . (int)$ticketId);
		$messages = [];
		while ($message = $result->Fetch()) $messages[] = $message;
		return static::fromMessages($messages);
	}

	/** Собрать пары дат; незавершённая пауза имеет END = null. */
	static public function fromMessages(array $messages) {
		$intervals = [];
		$start = null;
		foreach ($messages as $message) {
			$text = isset($message['MESSAGE_SEARCH']) ? $message['MESSAGE_SEARCH'] : '';
			if (stripos($text, 'ОБРАЩЕНИЕ ОТЛОЖЕНО') !== false) {
				// Повторный маркер не сдвигает начало уже открытой паузы.
				if ($start === null) $start = $message['DATE_CREATE'];
			} elseif (stripos($text, 'ОБРАЩЕНИЕ ВОССТАНОВЛЕНО ИЗ ОТЛОЖЕННЫХ') !== false) {
				// Восстановление без начала не должно заимствовать дату другой заявки.
				if ($start !== null) $intervals[] = ['START' => $start, 'END' => $message['DATE_CREATE']];
				$start = null;
			}
		}
		if ($start !== null) $intervals[] = ['START' => $start, 'END' => null];
		return $intervals;
	}

	/** Дополнить ответы всех способов загрузки заявок, не повторяя запрос для одного ID. */
	static public function attached(array $tickets) {
		$cache = [];
		foreach ($tickets as &$ticket) {
			$id = (int)$ticket['ID'];
			if (!isset($cache[$id])) $cache[$id] = static::load($id);
			$ticket['HOLD_INTERVALS'] = $cache[$id];
		}
		unset($ticket);
		return $tickets;
	}
}
