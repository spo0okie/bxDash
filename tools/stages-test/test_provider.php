<?php
// Проверка провайдера стадий на временной базе локального MySQL (root без пароля, 127.0.0.1:3306).
// База bxdash_stage_tmp_test создаётся и удаляется самим тестом.
// Запуск: cd back && php ../tools/stages-test/test_provider.php
require __DIR__ . '/stubs.php';
require 'app/router.php';

$fails = 0; $n = 0;
function ok($cond, $name) {
	global $fails, $n; $n++;
	if (!$cond) { $fails++; echo "FAIL: $name\n"; } else echo "ok   $name\n";
}
function throws($fn, $code, $name) {
	try { $fn(); ok(false, $name . ' (нет исключения)'); }
	catch (stages_exception $e) { ok($e->httpCode === $code, $name . ' [' . $e->httpCode . ': ' . $e->getMessage() . ']'); }
}

// временная база
$exists = $DB->m->query("SHOW DATABASES LIKE '" . TEST_DB . "'")->num_rows;
if ($exists) { echo "База " . TEST_DB . " уже существует, прерываюсь\n"; exit(2); }
$DB->m->query("CREATE DATABASE " . TEST_DB . " CHARACTER SET utf8mb4");
$DB->m->select_db(TEST_DB);

try {
	router::loadModel('stages_provider');
	$p = stages_provider::instance();
	ok($p instanceof stages_provider_table, 'провайдер по умолчанию — table');
	ok($p === stages_provider::instance(), 'instance() — синглтон');

	// таблиц ещё нет: первый же запрос сам создаёт их и повторяется
	ok($p->getItemStages('task', [1, 2]) === [], 'без таблиц: чтение привязок само ставит таблицы');
	ok($DB->m->query("SHOW TABLES LIKE 'bxdash_%'")->num_rows === 2, 'обе таблицы созданы');

	// настоящая ошибка БД после автоустановки не глотается
	try {
		$bad = new ReflectionMethod($p, 'query');
		$bad->setAccessible(true);
		$bad->invoke($p, 'SELECT nosuch FROM bxdash_stage');
		ok(false, 'ошибка SQL должна быть исключением');
	} catch (Exception $e) { ok(strpos($e->getMessage(), 'Ошибка БД') === 0, 'ошибка SQL — исключение: ' . $e->getMessage()); }

	$p->install();
	$p->install();
	ok(true, 'install идемпотентен');

	// ленивая стадия по умолчанию
	$s = $p->getStages(1);
	ok(count($s) === 1 && $s[0]['TITLE'] === 'Входящие' && $s[0]['IS_DEFAULT'] === 'Y', 'лениво создана «Входящие»');
	ok($s[0]['ID'] === (int)$s[0]['ID'] && $s[0]['COLOR'] === null && $s[0]['SORT'] === 100, 'типы полей');
	ok(count($p->getStages(1)) === 1, 'повторный вызов не плодит стадии');
	$def1 = $p->getDefaultStageId(1);
	ok($def1 === $s[0]['ID'], 'getDefaultStageId');

	// создание
	$wait = $p->createStage(1, '  Ожидание  ', '#FFAA00');
	$review = $p->createStage(1, 'На проверке');
	$far = $p->createStage(1, 'Дальние', null, 50);
	$st = $p->getStage($wait);
	ok($st['TITLE'] === 'Ожидание' && $st['COLOR'] === '#ffaa00' && $st['SORT'] === 200 && $st['IS_DEFAULT'] === 'N', 'createStage: trim, цвет, sort');
	ok($p->getStage($review)['SORT'] === 300, 'sort следующей +100');
	$order = array_column($p->getStages(1), 'ID');
	ok($order === [$far, $def1, $wait, $review], 'порядок по SORT');
	throws(function () use ($p) { $p->createStage(1, '   '); }, 409, 'пустое название');
	throws(function () use ($p) { $p->createStage(1, 'x', 'red'); }, 409, 'плохой цвет');
	throws(function () use ($p) { $p->createStage(0, 'x'); }, 409, 'нет пользователя');
	$long = $p->createStage(1, str_repeat('я', 300));
	ok(mb_strlen($p->getStage($long)['TITLE'], 'UTF-8') === 255, 'название обрезано до 255 символов');
	$p->deleteStage($long);

	// правка
	$p->updateStage($wait, ['TITLE' => 'Ждём', 'COLOR' => null]);
	$st = $p->getStage($wait);
	ok($st['TITLE'] === 'Ждём' && $st['COLOR'] === null, 'updateStage: название и сброс цвета');
	$p->updateStage($def1, ['TITLE' => 'Мои входящие']);
	ok($p->getStage($def1)['TITLE'] === 'Мои входящие' && $p->getStage($def1)['IS_DEFAULT'] === 'Y', 'стадию по умолчанию можно переименовать');
	throws(function () use ($p, $wait) { $p->updateStage($wait, []); }, 409, 'пустая правка');
	throws(function () use ($p) { $p->updateStage(99999, ['TITLE' => 'x']); }, 404, 'правка несуществующей');
	$p->updateStage($wait, ['TITLE' => "O'Reilly \"x\" \\ ;--"]);
	ok($p->getStage($wait)['TITLE'] === "O'Reilly \"x\" \\ ;--", 'экранирование кавычек');

	// порядок
	$p->reorderStages(1, [$review, $wait]);
	$order = array_column($p->getStages(1), 'ID');
	ok($order === [$review, $wait, $far, $def1], 'reorder: перечисленные вперёд, остальные в прежнем порядке');
	$other = $p->createStage(2, 'Чужой');
	throws(function () use ($p, $other) { $p->reorderStages(1, [$other]); }, 409, 'reorder с чужой стадией');
	throws(function () use ($p) { $p->reorderStages(1, []); }, 409, 'reorder без ids');

	// привязки
	$p->setItemStage('task', 10, 1, $wait);
	$p->setItemStage('task', 10, 2, $other);
	$p->setItemStage('task', 11, 1, $review);
	$p->setItemStage('job', 10, 1, $far);
	$m = $p->getItemStages('task', [10, 11, 12, '10', 0, -5]);
	ok($m === [10 => [1 => $wait, 2 => $other], 11 => [1 => $review]], 'getItemStages: по пользователям, без лишнего');
	ok($p->getItemStages('job', [10]) === [10 => [1 => $far]], 'типы элементов не смешиваются');
	ok($p->getItemStages('task', []) === [], 'пустой список id');
	$p->setItemStage('task', 10, 1, $review);
	ok($p->getItemStages('task', [10])[10][1] === $review, 'повторная привязка заменяет');
	$p->setItemStage('task', 10, 1, $def1);
	ok(!isset($p->getItemStages('task', [10])[10][1]), 'привязка к стадии по умолчанию = нет строки');
	$p->setItemStage('task', 11, 1, null);
	ok($p->getItemStages('task', [11]) === [], 'null снимает привязку');
	throws(function () use ($p, $other) { $p->setItemStage('task', 10, 1, $other); }, 409, 'чужая стадия');
	throws(function () use ($p) { $p->setItemStage('task', 10, 1, 99999); }, 404, 'несуществующая стадия');
	throws(function () use ($p, $wait) { $p->setItemStage('plan', 10, 1, $wait); }, 409, 'неизвестный тип');
	throws(function () use ($p, $wait) { $p->setItemStage('task', 0, 1, $wait); }, 409, 'нет элемента');
	ok(count($p->getItemStages('task', range(1, 2500))) === 1, 'большая пачка id (чанки)');

	// удаление
	throws(function () use ($p, $def1) { $p->deleteStage($def1); }, 409, 'удаление стадии по умолчанию');
	throws(function () use ($p) { $p->deleteStage(99999); }, 404, 'удаление несуществующей');
	throws(function () use ($p, $wait) { $p->deleteStage($wait, $wait); }, 409, 'перенос в саму себя');
	throws(function () use ($p, $wait, $other) { $p->deleteStage($wait, $other); }, 409, 'перенос в чужую');
	$p->setItemStage('task', 20, 1, $wait);
	$p->setItemStage('task', 21, 1, $wait);
	ok($p->deleteStage($wait, $review) === $review, 'deleteStage возвращает цель');
	$m = $p->getItemStages('task', [20, 21]);
	ok($m[20][1] === $review && $m[21][1] === $review, 'элементы перенесены в указанную стадию');
	ok($p->getStage($wait) === null, 'стадия удалена');
	ok($p->deleteStage($review) === $def1, 'без moveTo — в стадию по умолчанию');
	ok($p->getItemStages('task', [20, 21]) === [], 'перенос в default = строки удалены');
	ok($p->getItemStages('task', [10]) === [10 => [2 => $other]], 'чужие привязки не тронуты');

	$p->removeItem('task', 10);
	ok($p->getItemStages('task', [10]) === [] && $p->getItemStages('job', [10]) !== [], 'removeItem только свой тип');

	// самолечение: два default и ни одного default
	$DB->Query("INSERT INTO bxdash_stage (USER_ID, TITLE, SORT, IS_DEFAULT) VALUES (3,'Входящие',100,'Y'),(3,'Входящие',100,'Y'),(3,'Важное',200,'Y')");
	$s = $p->getStages(3);
	$defs = array_values(array_filter($s, function ($x) { return $x['IS_DEFAULT'] === 'Y'; }));
	ok(count($s) === 2 && count($defs) === 1 && $s[1]['TITLE'] === 'Важное' && $s[1]['IS_DEFAULT'] === 'N', 'дубли default: пустышка удалена, именованная разжалована');
	$DB->Query("UPDATE bxdash_stage SET IS_DEFAULT='N' WHERE USER_ID=3");
	$s = $p->getStages(3);
	ok($s[0]['IS_DEFAULT'] === 'Y' && $s[1]['IS_DEFAULT'] === 'N', 'нет default: назначается первая');

	// ---------- стопки: столбцы друг под другом ----------
	$u = 2;
	$d2 = $p->getDefaultStageId($u);
	$s1 = $p->createStage($u, 'В работе');
	$s2 = $p->createStage($u, 'Ожидание');
	$s3 = $p->createStage($u, 'Дальние');
	$stackOf = function () use ($p, $u) {
		$out = [];
		foreach ($p->getStages($u) as $s) $out[] = $s['ID'] . ($s['STACKED'] === 'Y' ? '^' : '');
		return implode(' ', $out);
	};
	$base = array_column($p->getStages($u), 'ID');
	ok(strpos($stackOf(), '^') === false, 'новые столбцы не в стопке: ' . $stackOf());

	$p->reorderStages($u, [$d2, $s1, $s2, $s3], [$s1, $s3]);
	ok(strpos($stackOf(), $d2 . ' ' . $s1 . '^ ' . $s2 . ' ' . $s3 . '^') !== false, 'reorder со stacked: ' . $stackOf());
	$p->reorderStages($u, [$s2, $s3, $d2, $s1]);
	ok(strpos($stackOf(), $s2 . ' ' . $s3 . '^ ' . $d2 . ' ' . $s1 . '^') !== false, 'reorder без stacked признак не трогает: ' . $stackOf());
	$p->reorderStages($u, [$s2, $s3, $d2, $s1], []);
	ok(strpos($stackOf(), '^') === false, 'пустой stacked разбирает все стопки: ' . $stackOf());

	// удаление верхнего столбца стопки: нижний встаёт на его место, а не уезжает в стопку слева
	$p->reorderStages($u, [$d2, $s1, $s2, $s3], [$s2, $s3]);
	$p->deleteStage($s1);
	ok(strpos($stackOf(), $d2 . ' ' . $s2 . ' ' . $s3 . '^') !== false, 'удалён верх стопки — следующий стал верхним: ' . $stackOf());
	$p->deleteStage($s3);
	ok(strpos($stackOf(), '^') === false, 'удалён нижний — остальные не тронуты: ' . $stackOf());

	// таблица старого образца (без STACKED) доращивается сама
	$DB->Query("ALTER TABLE bxdash_stage DROP COLUMN STACKED");
	$fresh = new stages_provider_table();
	$rows = $fresh->getStages($u);
	ok(isset($rows[0]['STACKED']) && $rows[0]['STACKED'] === 'N', 'колонка STACKED добавляется при первом обращении');

	// ---------- связка с контроллерами элементов ----------
	$setInput = function ($json) {
		foreach (['input' => $json, 'inputJson' => null] as $prop => $value) {
			$ref = new ReflectionProperty('router', $prop);
			$ref->setAccessible(true);
			$ref->setValue(null, $value);
		}
	};
	$_SERVER['REQUEST_URI'] = '/x/y/api/task/update/30';
	$a = $p->createStage(1, 'A');

	$setInput('{"sorting":500}');
	ok(stages_provider::requested() === false && stages_provider::applyRequest('task', 30) === false, 'без stage привязка не трогается');

	$setInput('{"stage":' . $a . ',"stageUser":1}');
	ok(stages_provider::requested() === true && stages_provider::applyRequest('task', 30) === true, 'applyRequest применяет stage/stageUser');
	ok($p->getItemStages('task', [30]) === [30 => [1 => $a]], 'привязка из запроса записана');

	$list = stages_provider::attached('task', [
		['ID' => '30', 'TITLE' => 'с привязкой'],
		['ID' => '31', 'TITLE' => 'без привязки'],
	]);
	$json = json_encode($list, JSON_UNESCAPED_UNICODE);
	ok(strpos($json, '"STAGES":{"1":' . $a . '}') !== false, 'STAGES с привязкой — объект {userId: stageId}: ' . $json);
	ok(strpos($json, '"TITLE":"без привязки","STAGES":{}') !== false, 'STAGES без привязки — пустой объект, не массив');
	ok(json_encode(stages_provider::attached('task', [])) === '[]', 'пустой список остаётся списком');
	$keyed = stages_provider::attached('job', [7 => ['ID' => 5], 9 => ['ID' => 6]]);
	ok(array_keys($keyed) === [7, 9] && isset($keyed[7]['STAGES']), 'ключи списка сохраняются');

	$setInput('{"stage":null,"stageUser":1}');
	ok(stages_provider::applyRequest('task', 30) === true && $p->getItemStages('task', [30]) === [], 'stage:null снимает привязку');
} finally {
	$DB->m->query("DROP DATABASE " . TEST_DB);
	echo "база " . TEST_DB . " удалена\n";
}
echo "\n$n проверок, провалено: $fails\n";
exit($fails ? 1 : 0);
