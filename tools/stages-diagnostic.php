<?php
/** Диагностика штатного канбана текущего пользователя: только чтение, без создания стадий и таблиц. */
define('NO_KEEP_STATISTIC', true);
define('NO_AGENT_STATISTIC', true);
define('NOT_CHECK_FILE_PERMISSIONS', true);
require $_SERVER['DOCUMENT_ROOT'].'/bitrix/modules/main/include/prolog_before.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
global $USER;
if (!$USER->IsAuthorized()) {
	header('HTTP/1.1 401 Unauthorized');
	exit(json_encode(array('error' => 'Требуется вход на портал')));
}
if (!CModule::IncludeModule('tasks')) {
	header('HTTP/1.1 500 Internal Server Error');
	exit(json_encode(array('error' => 'Модуль tasks недоступен')));
}

/** Описывает установленный API, не вызывая методы, которые могут создать стадии. */
function describeStagesApi($class) {
	if (!class_exists($class)) return array('available' => false);
	$reflection = new ReflectionClass($class);
	$result = array('available' => true, 'constants' => $reflection->getConstants(), 'methods' => array());
	foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
		if ($method->getDeclaringClass()->getName() !== $reflection->getName()) continue;
		$params = array();
		foreach ($method->getParameters() as $param) {
			$params[] = array('name' => $param->getName(), 'optional' => $param->isOptional());
		}
		$result['methods'][$method->getName()] = array('static' => $method->isStatic(), 'params' => $params);
	}
	// Исходники именно классов канбана нужны для проверки побочных эффектов и прав перед реализацией записи.
	$file = $reflection->getFileName();
	if ($file && is_readable($file)) {
		$lines = file($file);
		$result['source'] = implode('', array_slice($lines, $reflection->getStartLine() - 1,
			$reflection->getEndLine() - $reflection->getStartLine() + 1));
	}
	return $result;
}

$output = array('sessionUserId' => (int)$USER->GetID());
foreach (array('stages' => 'Bitrix\\Tasks\\Kanban\\StagesTable',
	'taskStages' => 'Bitrix\\Tasks\\Kanban\\TaskStageTable') as $key => $class) {
	try {
		$output[$key] = describeStagesApi($class);
	} catch (Exception $e) {
		$output[$key] = array('error' => $e->getMessage());
	} catch (Throwable $e) {
		$output[$key] = array('error' => $e->getMessage());
	}
}

try {
	$class = 'Bitrix\\Tasks\\Kanban\\StagesTable';
	if (class_exists($class)) {
		// Читаем строки ORM напрямую: getStages() может лениво создавать стандартные стадии.
		$rows = $class::getList(array('filter' => array('=ENTITY_ID' => (int)$USER->GetID()),
			'order' => array('SORT' => 'ASC')));
		$output['userStages'] = array();
		while ($row = $rows->fetch()) $output['userStages'][] = $row;
		$class = 'Bitrix\\Tasks\\Kanban\\TaskStageTable';
		if (class_exists($class)) {
			// Только привязки к стадиям личного плана текущего пользователя.
			$ids = array();
			foreach ($output['userStages'] as $stage) {
				if (isset($stage['ENTITY_TYPE']) && $stage['ENTITY_TYPE'] === 'P') $ids[] = (int)$stage['ID'];
			}
			$output['taskBindings'] = array();
			if ($ids) {
				$rows = $class::getList(array('filter' => array('@STAGE_ID' => $ids), 'limit' => 20));
				while ($row = $rows->fetch()) $output['taskBindings'][] = $row;
			}
		}
	}
} catch (Exception $e) {
	$output['readError'] = $e->getMessage();
} catch (Throwable $e) {
	$output['readError'] = $e->getMessage();
}
echo json_encode($output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
