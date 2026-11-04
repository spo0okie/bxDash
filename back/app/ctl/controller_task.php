<?php
/*
 * Класс инициации исходящих звонков в астериске
 */

// привязки элементов к столбцам канбан-доски (поле STAGES, параметры stage/stageUser)
if (!class_exists('stages_provider', false)) router::loadModel('stages_provider');

class controller_task {
	const MSG_OK='OK';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_TASK_ID='NO_TASK_ID_SET';
	static $arViewedDates=[];

	static public $fieldsMap = [
		'ID',
		'PARENT_ID',
		'TITLE',
		'RESPONSIBLE_ID',
		'ACCOMPLICES',
		'AUDITORS',
		'CREATED_BY',
		'REAL_STATUS',
		'MARK',
		'UPDATES_COUNT',
		'DEADLINE',
		'CREATED_DATE',
		'CLOSED_DATE',
		'XML_ID',
		'PRIORITY',
		'FAVORITE',
	];


	static public function initTaskData($arTask) {
		global $globalTzOffset;
		static::$arViewedDates[$arTask['ID']] = $arTask['VIEWED_DATE'] ? $arTask['VIEWED_DATE'] : $arTask['CREATED_DATE'];

		// GetList не возвращает все роли: дополняем соисполнителей и наблюдателей из участников.
		$arTask['ACCOMPLICES'] = array();
		$arTask['AUDITORS'] = array();
		$resMembers = CTaskMembers::GetList(array(), array("TASK_ID" => $arTask['ID']));
		while ($arMember = $resMembers->Fetch()) {
			if (
				($arMember["TYPE"] == "A" ) //упер из метода GetByID. Тот который GetList по умолчанию не вытягивает соисполнителей
				&&
				($arTask['RESPONSIBLE_ID']!=$arMember["USER_ID"]) //на всякий случай проверяем, что у нас соисполнитель не является ответственным
			) {
				$arTask["ACCOMPLICES"][] = $arMember["USER_ID"];
			}
			if ($arMember['TYPE'] == 'U') $arTask['AUDITORS'][] = $arMember['USER_ID'];
		}
		$arTask['tzShift']=$globalTzOffset;
		return $arTask;
	}

	static public function initTaskUpdates(&$tasks) {
		$arUpdatesCount = CTasks::GetUpdatesCount(static::$arViewedDates);
		foreach ($arUpdatesCount as $i => $count)
			$tasks[$i]['UPDATES_COUNT']=(integer)$count;
	}


	static private function loadTasksByIds(array $ids) {
		$ids = array_values(array_filter(array_unique(array_map('intval', $ids))));
		if (empty($ids)) return [];
		$filter = [
			'::LOGIC' => 'AND',
			'CHECK_PERMISSIONS' => 'Y',
			'ID' => $ids,
		];
		$res = CTasks::GetList(['ID' => 'ASC'], $filter);
		$result = [];
		while ($arTask = $res->GetNext()) {
			$result[$arTask['ID']] = static::initTaskData($arTask);
		}
		static::initTaskUpdates($result);
		return $result;
	}

	/**
	 * Загружает задачи ответственных и соисполнителей за указанный период.
	 */
	static public function loadPeriodUsers($from,$to,$users){
		//смещаем на часовой пояс
		if ($to) $to-=3600*3;
		$from-=3600*3;
		//error_log('loadPeriodUsers:'.ConvertTimeStamp($from, "FULL"));
		//error_log('loadPeriodUsers:'.ConvertTimeStamp($to, "FULL"));

		$tasks=[];

		if (is_null($to)) {
			//открытый конец периода (ведро/долгий ящик с задачами "далеко и без срока")
			$closedTasks=[
				'REAL_STATUS'=>[5,7],
				'>=CLOSED_DATE' => ConvertTimeStamp($from, "FULL"),
			];

			if($from<time()) {
				//если отметка ОТ не позже чем сейчас, то все просроченные тоже попадают
				$openTasks=[
					'!REAL_STATUS'=>[5,7],
				];
			} else {
				$openTasks=[
					'!REAL_STATUS'=>[5,7],
					'::SUBFILTER-1' => [
						'::LOGIC' => 'OR',
						'>=DEADLINE' => ConvertTimeStamp($from, "FULL"),
						'DEADLINE'=>'',
					],
				];
			}
		}else {
			$closedTasks=[
				'REAL_STATUS'=>[5],
				'>=CLOSED_DATE' => ConvertTimeStamp($from, "FULL"),
				'<CLOSED_DATE' => ConvertTimeStamp($to, "FULL"),
			];

			$openTasks=[
				'!REAL_STATUS'=>[5,7],
				'<DEADLINE' => ConvertTimeStamp($to, "FULL"),
				'>=DEADLINE' => ConvertTimeStamp($from, "FULL"),
			];

			//если период начинается сейчас или даже раньше, то добавляем все просроченные задачи убирая фильтр "ОТ"
			if ($from<=time())
				unset($openTasks['>=DEADLINE']);
		}


		$filter=[
			'::LOGIC' => 'AND',
			'CHECK_PERMISSIONS' => 'Y',
		];

		if (!is_null($to) && $to<time()) {
			//отметка ДО раньше текущего времени - это прошлый период. Открытых задач там нет
			//(они есть но все просроченные выводим в текущее время, а не в прошлое)
			$filter['::SUBFILTER-2']=$closedTasks;
		} else {
			$filter['::SUBFILTER-2']=[
				'::LOGIC' => 'OR',
				'::SUBFILTER-1' =>$openTasks,
				'::SUBFILTER-2' =>$closedTasks,
			];
		}
		//var_dump($filter);

		// На Bitrix 24 OR с ACCOMPLICE исключает задачу ответственного без
		// соисполнителей. Независимые запросы не смешивают фильтры участников.
		foreach (array('RESPONSIBLE_ID', 'ACCOMPLICE') as $role) {
			$roleFilter = $filter;
			$roleFilter[$role] = $users;
			$res = CTasks::GetList(array('DEADLINE' => 'ASC'), $roleFilter);
			while ($arTask = $res->GetNext()) {
				// Задача может прийти по обеим ролям; участников читаем один раз.
				if (!isset($tasks[$arTask['ID']])) $tasks[$arTask['ID']] = static::initTaskData($arTask);
			}
		}

		if (is_null($to)) {
			// Контроль и «От меня» включают все открытые задачи, независимо от плановой даты.
			// Скалярные ID в каждой ветке обходят ограничения старого Bitrix на массивы ролей.
			$roles = array('::LOGIC' => 'OR');
			$roleIndex = 0;
			foreach (array_unique(array_map('intval', $users)) as $userId) {
				if ($userId <= 0) continue;
				$roles['::SUBFILTER-' . (++$roleIndex)] = array('AUDITOR' => $userId);
				$roles['::SUBFILTER-' . (++$roleIndex)] = array('CREATED_BY' => $userId);
			}
			if ($roleIndex) {
				$roleFilter = array(
					'CHECK_PERMISSIONS' => 'Y',
					'!REAL_STATUS' => array(5, 7),
					'::SUBFILTER-1' => $roles,
				);
				$res = CTasks::GetList(array('ID' => 'ASC'), $roleFilter);
				while ($arTask = $res->GetNext()) {
					// Одна задача может прийти по нескольким ролям; участников читаем только один раз.
					if (!isset($tasks[$arTask['ID']])) $tasks[$arTask['ID']] = static::initTaskData($arTask);
				}
			}
		}

		static::initTaskUpdates($tasks);

		return array_values($tasks);
	}

	public function action_load(){
		if (is_null($from=router::getRoute(3, 'from')))
			router::haltJson(static::MSG_NO_FROM);

		if (is_null($to=router::getRoute(4, 'to')))
			router::haltJson(static::MSG_NO_TO);
		if ($to=='null') $to=null; //открытый конец

		if (is_null($users= router::getRoute(5, 'users')))
			router::haltJson(static::MSG_NO_USERS);
		$result = [];
		$tasks = static::loadPeriodUsers($from, $to,explode(',',$users));
		$byIds=router::getIds();
		foreach ($tasks as $task) {
			$id=(int)$task['ID'];
			$result[$task['ID']] = $task;
			if (in_array($id,$byIds)) unset($byIds[$id]);
		}

		$linkedTasks = static::loadTasksByIds($byIds);
		foreach ($linkedTasks as $task) {
			$id=(int)$task['ID'];
			$result[$task['ID']] = $task;
		}
		echo json_encode(stages_provider::attached('task', array_values($result)),JSON_UNESCAPED_UNICODE);
	}

	public function action_linked(){
		// Возвращаем только объекты из ids, без фильтра по периодам/пользователям
		$tasks = static::loadTasksByIds(router::getIds());
		echo json_encode(stages_provider::attached('task', array_values($tasks)),JSON_UNESCAPED_UNICODE);
	}

	/**
	 * Полнотекстовый поиск задач по названию и описанию
	 * GET /task/search?q={searchQuery}
	 */
	public function action_search() {
		// PHP 5 совместимость: заменен оператор ?? на isset()
		$query = isset($_GET['q']) ? $_GET['q'] : '';
		$queryLower = mb_strtolower($query, 'UTF-8');
		
		// Проверка минимальной длины запроса (минимум 3 символа)
		if (strlen($query) < 3) {
			router::haltJson('Query too short');
		}
			
		$tasks=[];

		

		// Использовать поиск для нахождения сообщений с "klg-ns1"
		$arFilter = array(
	    	"MODULE_ID" => "forum",
	    	"SITE_ID" => SITE_ID,
		    "QUERY" => $query
		);

		$obSearch = new CSearch();
		$obSearch->Search($arFilter, array("DATE_CHANGE" => "DESC"));

		$found = false;

		while ($arSearch = $obSearch->GetNext()) {
    		// Для форума ITEM_ID - это MESSAGE_ID
	    	$messageId = $arSearch["ITEM_ID"];
    
    		// Получить сообщение
		    $arMessage = CForumMessage::GetByID($messageId);
	    	if ($arMessage && strpos($arMessage["POST_MESSAGE"], $query) !== false) {
        		$topicId = $arMessage["TOPIC_ID"];
				//echo $topicId;
        
	    	    // Найти задачу
    		    $rsTask = CTasks::GetList(array(), array("FORUM_TOPIC_ID" => $topicId), array("ID"));
	        	if ($arTask = $rsTask->Fetch()) {
	        	    $tasks[$arTask["ID"]] = $arTask["ID"];
					//echo $arTask["ID"];
    		    }
		    }
		}

		// Теперь поиск по тексту задач
		$arFilterTasks = array(
    		"MODULE_ID" => "tasks",
	    	"SITE_ID" => SITE_ID,
    		"QUERY" => $query
		);

		$obSearchTasks = new CSearch();
		$obSearchTasks->Search($arFilterTasks, array("DATE_CHANGE" => "DESC"));

		while ($arSearchTask = $obSearchTasks->GetNext()) {
	    	// Для задач ITEM_ID - это TASK_ID
	    	$taskId = $arSearchTask["ITEM_ID"];
    
		    // Проверить, что задача существует и содержит $query
	    	$rsTask = CTasks::GetList(array(), array("ID" => $taskId), array("ID", "TITLE", "DESCRIPTION"));
	    	if ($arTask = $rsTask->Fetch()) {
    		    $text = $arTask["TITLE"] . " " . $arTask["DESCRIPTION"];
	        	if (strpos($text, $query) !== false) {
            		$tasks[$arTask["ID"]] = $arTask["ID"];
	        	}
    		}
		}
		
		// Ограничиваем общее количество результатов до 100
		$tasks = array_slice($tasks, 0, 100, true);
		
		// Если нет результатов - возвращаем пустой массив
		if (empty($tasks)) {
			echo json_encode(array(), JSON_UNESCAPED_UNICODE);
			return;
		}
		
		// Загружаем полные данные задач через существующие методы
		$tasks = static::loadTasksByIds(array_values($tasks));
		
		// Возвращаем в том же формате, что и action_load
		echo json_encode(stages_provider::attached('task', array_values($tasks)),JSON_UNESCAPED_UNICODE);
	}

	public function action_get(){
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TASK_ID);

		$ids = router::getIds();
		array_unshift($ids,$id);
		$tasks = static::loadTasksByIds($ids);
		if (!isset($tasks[$id]))
			router::haltJson("Error loading Task");
		echo json_encode(stages_provider::attached('task', array_values($tasks)),JSON_UNESCAPED_UNICODE);
	}

	function action_update() {
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TASK_ID);

		$userID=CUser::GetID();

		$oTaskItem=new CTaskItem($id,$userID);
		$arTask=$oTaskItem->GetData();

		// Самонаблюдение — параметр общего update; пользователь берётся только из сессии.
		$watching = router::getRoute(null, 'watching', '##UNSET');
		if ($watching !== '##UNSET') {
			if (!is_bool($watching)) router::haltJson('Параметр watching должен быть логическим', 409);
			if ((int)$arTask['RESPONSIBLE_ID'] === (int)$userID || (int)$arTask['CREATED_BY'] === (int)$userID) {
				router::haltJson('Ответственный и постановщик не могут менять собственное наблюдение', 409);
			}
			// Штатные методы сохраняют остальных наблюдателей и проверяют права Bitrix.
			if (!method_exists($oTaskItem, $watching ? 'startWatch' : 'stopWatch')) {
				router::haltJson('Версия Bitrix не поддерживает переключение наблюдения', 409);
			}
			try {
				if ($watching) $oTaskItem->startWatch();
				else $oTaskItem->stopWatch();
			} catch (\Exception $e) {
				router::haltJson($e->getMessage(), 409);
			} catch (\Throwable $e) {
				router::haltJson($e->getMessage(), 409);
			}
		}


		if ($responsible=router::getRoute(null,'user')) {
			$oTaskItem->Update(['RESPONSIBLE_ID'=>$responsible]);
			if (in_array($responsible,$arTask['ACCOMPLICES'])) {
				$accomplices=$arTask['ACCOMPLICES'];
				unset($accomplices[array_search($responsible,$accomplices)]);
				$accomplices[]=$arTask['RESPONSIBLE_ID'];
				$oTaskItem->Update(['ACCOMPLICES'=>$accomplices]);
			}
		}
		$deadline=router::getRoute(null,'deadline','##UNSET');
		if ($deadline!=='##UNSET') {
			if ($deadline=='null' || !$deadline) {
				$deadline='';
			} else {
				$deadline=date('d.m.Y',$deadline).' 17:00:00';
			}
			//echo $deadline;
			$oTaskItem->Update(['DEADLINE'=>$deadline]);
		}

		$startDatePlan=router::getRoute(null,'startDatePlan','##UNSET');
		if ($startDatePlan!=='##UNSET') {
			if ($startDatePlan=='null' || !$startDatePlan) {
				$startDatePlan='';
			} else {
				$startDatePlan=date('d.m.Y',$startDatePlan).' 09:00:00';
			}
			$oTaskItem->Update(['START_DATE_PLAN'=>$startDatePlan]);
		}

		if ($status=router::getRoute(null,'status')) {
			$oTaskItem->Update(['STATUS'=>$status]);
		}

		if ($sorting=router::getRoute(null,'sorting')) {
			$oTaskItem->Update(['XML_ID' => $sorting]);
		}

		$priority=router::getRoute(null,'priority','##UNSET');
		if ($priority!=='##UNSET') {
			$oTaskItem->Update(['PRIORITY' => $priority]);
		}

		stages_provider::applyRequest('task', $id);

		echo '{"result":"ok","id":'.$id.'}';
	}



	function action_create() {
		global $newTaskTemplate, $APPLICATION;

		if (!($text=router::getRoute(null,'title'))) router::haltJson('no text data');
		if (!($responsible=router::getRoute(null,'user'))) router::haltJson('no responsible');
		if (($deadline=router::getRoute(null,'deadline',-1))===-1) router::haltJson('no deadline');
		$startDatePlan=router::getRoute(null,'startDatePlan',null);
		$sorting=router::getRoute(null,'sorting');

		$lines=explode("\n",$text);
		$title=$lines[0];
		if (count($lines)>1) {
			unset($lines[0]);
			$description=implode("\n",$lines);
		} else $description='';



		$data=array_merge($newTaskTemplate,[
			'TITLE' => $title,
			'DESCRIPTION'=>$description,
			'DEADLINE'=>$deadline?ConvertTimeStamp($deadline,'FULL'):'',
			'START_DATE_PLAN'=>($startDatePlan && $startDatePlan!=='null')?ConvertTimeStamp($startDatePlan,'FULL'):'',
			'ALLOW_CHANGE_DEADLINE'=>$allowMoveDeadline,
			'RESPONSIBLE_ID'=>$responsible,
			'XML_ID' => $sorting
		]);

		$obTask = new CTasks;

		if (!$taskId=$obTask->Add($data)) {
			$reason = '';
			if (!empty($obTask->LAST_ERROR)) {
				$reason = is_array($obTask->LAST_ERROR)
					? implode('; ', $obTask->LAST_ERROR)
					: (string)$obTask->LAST_ERROR;
			}
			if (!$reason && is_object($APPLICATION)) {
				$ex = $APPLICATION->GetException();
				if ($ex) $reason = $ex->GetString();
			}
			if (!$reason) $reason = 'unknown error';

			router::haltJson('error creating task: '.$reason, 500, [
				'reason' => $reason,
				'data'   => $data,
			]);
		}

		stages_provider::applyRequest('task', $taskId);

		echo '{"result":"ok","id":'.$taskId.'}';
	}

}

?>
