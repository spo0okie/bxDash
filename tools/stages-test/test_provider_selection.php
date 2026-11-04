<?php
/** Выбор провайдера без портала и БД: legacy, modern, explicit-table, missing-native. */
$mode = isset($argv[1]) ? $argv[1] : 'legacy';
// Маркеры API позволяют проверить выбор без подключения настоящего модуля tasks.
class NativeStagesMarker {}
if ($mode === 'modern' || $mode === 'explicit-table') {
	class_alias('NativeStagesMarker', 'Bitrix\\Tasks\\Kanban\\StagesTable');
	class_alias('NativeStagesMarker', 'Bitrix\\Tasks\\Kanban\\TaskStageTable');
}
/** Загрузчик реальных классов провайдеров без запуска HTTP-маршрутизатора. */
class router {
	static function loadModel($name) { require_once __DIR__.'/../../back/app/models/'.$name.'.php'; }
}
require __DIR__.'/../../back/app/models/stages_provider.php';
if ($mode === 'explicit-table') $stagesProvider = 'table';
if ($mode === 'missing-native') $stagesProvider = 'bitrix';
try {
	$p = stages_provider::instance();
	if ($mode === 'missing-native') throw new Exception('Нельзя подменять отсутствующий bitrix провайдером table');
	$expected = $mode === 'modern' ? 'stages_provider_bitrix' : 'stages_provider_table';
	if (get_class($p) !== $expected) throw new Exception('Выбран неверный провайдер');
	if ($p !== stages_provider::instance()) throw new Exception('Нарушен синглтон');
} catch (Exception $e) {
	if ($mode !== 'missing-native' || strpos($e->getMessage(), 'Штатный API') === false) throw $e;
}
echo 'OK: выбор провайдера '.$mode."\n";
