<?php
require_once __DIR__ . '/../back/app/models/ticket_hold_intervals.php';

/** Проверка разбора реальных маркеров отчёта без подключения к порталу. */
function checkIntervals($messages, $expected) {
	$actual = ticket_hold_intervals::fromMessages($messages);
	if ($actual !== $expected) throw new Exception('Неверные интервалы: ' . var_export($actual, true));
}

/** Сообщение Bitrix с маркером перехода и датой. */
function message($text, $date) {
	return ['MESSAGE_SEARCH' => $text, 'DATE_CREATE' => $date];
}

$hold = 'ОБРАЩЕНИЕ ОТЛОЖЕНО';
$restore = 'ОБРАЩЕНИЕ ВОССТАНОВЛЕНО ИЗ ОТЛОЖЕННЫХ';
checkIntervals([], []);
checkIntervals([
	message($restore, '01.10.2026 10:00:00'),
	message($hold, '05.10.2026 12:00:00'),
	message($hold, '05.10.2026 13:00:00'),
	message('Обычное сообщение', '05.10.2026 14:00:00'),
	message($restore, '06.10.2026 12:00:00'),
	message($restore, '06.10.2026 13:00:00'),
	message($hold, '07.10.2026 12:00:00'),
	message($restore, '08.10.2026 12:00:00'),
	message($hold, '09.10.2026 12:00:00'),
], [
	['START' => '05.10.2026 12:00:00', 'END' => '06.10.2026 12:00:00'],
	['START' => '07.10.2026 12:00:00', 'END' => '08.10.2026 12:00:00'],
	['START' => '09.10.2026 12:00:00', 'END' => null],
]);
// Дата предыдущей заявки не должна попадать в следующую.
checkIntervals([message($restore, '12.10.2026 12:00:00')], []);
echo "OK: интервалы отложенности\n";
