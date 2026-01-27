<?php
/*
 * Класс инициации исходящих звонков в астериске
 */

class controller_task {
	const MSG_OK='OK';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_TASK_ID='NO_TASK_ID_SET';
	static $arViewedDates=[];


	static public function initTaskData($arTask) {
		global $globalTzOffset;
		static::$arViewedDates[$arTask['ID']] = $arTask['VIEWED_DATE'] ? $arTask['VIEWED_DATE'] : $arTask['CREATED_DATE'];

		//перебираем соисполнителей задачи
		$resMembers = CTaskMembers::GetList(array(), array("TASK_ID" => $arTask['ID']));
		while ($arMember = $resMembers->Fetch())
			if (
				($arMember["TYPE"] == "A" ) //упер из метода GetByID. Тот который GetList по умолчанию не вытягивает соисполнителей
				&&
				($arTask['RESPONSIBLE_ID']!=$arMember["USER_ID"]) //на всякий случай проверяем, что у нас соисполнитель не является ответственным
			) {
				$arTask["ACCOMPLICES"][] = $arMember["USER_ID"];
			}
		$arTask['tzShift']=$globalTzOffset;
		return $arTask;
	}

	static public function initTaskUpdates(&$tasks) {
		$arUpdatesCount = CTasks::GetUpdatesCount(static::$arViewedDates);
		foreach ($arUpdatesCount as $i => $count)
			$tasks[$i]['UPDATES_COUNT']=(integer)$count;
	}

	static private function parseLinkedIds($prefix) {
		$rawIds = router::getRoute(null, 'ids', '');
		if (!$rawIds) return [];
		$prefixLen = strlen($prefix) + 1; // include ':'
		$prefixLower = mb_strtolower($prefix . ':');
		$result = [];
		foreach (explode(',', $rawIds) as $token) {
			$token = trim($token);
			if ($token === '') continue;
			if (mb_strtolower(substr($token, 0, $prefixLen)) !== $prefixLower) continue;
			$id = (int)substr($token, $prefixLen);
			if ($id > 0) $result[$id] = $id;
		}
		return array_values($result);
	}

	static private function getLinkedTaskIds() {
		return static::parseLinkedIds('task');
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
	 * загружает работы переданных пользователей за указанный период
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
				'STATUS'=>[5,7],
				'>=CLOSED_DATE' => ConvertTimeStamp($from, "FULL"),
			];

			if($from<time()) {
				//если отметка ОТ не позже чем сейчас, то все просроченные тоже попадают
				$openTasks=[
					'!STATUS'=>[5,7],
				];
			} else {
				$openTasks=[
					'!STATUS'=>[5,7],
					'::SUBFILTER-1' => [
						'::LOGIC' => 'OR',
						'>=DEADLINE' => ConvertTimeStamp($from, "FULL"),
						'DEADLINE'=>'',
					],
				];
			}
		}else {
			$closedTasks=[
				'STATUS'=>[5],
				'>=CLOSED_DATE' => ConvertTimeStamp($from, "FULL"),
				'<CLOSED_DATE' => ConvertTimeStamp($to, "FULL"),
			];

			$openTasks=[
				'!STATUS'=>[5,7],
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
			'::SUBFILTER-1' => [
				'::LOGIC' => 'OR',
				'ACCOMPLICE' => $users,
				'RESPONSIBLE_ID' => $users
			],
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

		$res=CTasks::GetList(["DEADLINE" => "ASC"],$filter);
		while ($arTask = $res->GetNext()) {
			//кладем задачу пользователю в табличку
			$tasks[$arTask['ID']]=static::initTaskData($arTask);
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
		$tasks = static::loadPeriodUsers($from, $to,explode(',',$users));
		$linkedTasks = static::loadTasksByIds(static::getLinkedTaskIds());
		$result = [];
		foreach ($tasks as $task) {
			$result[$task['ID']] = $task;
		}
		foreach ($linkedTasks as $task) {
			$result[$task['ID']] = $task;
		}
		echo json_encode(array_values($result),JSON_UNESCAPED_UNICODE);
	}

	public function action_linked(){
		// Возвращаем только объекты из ids, без фильтра по периодам/пользователям
		$tasks = static::loadTasksByIds(static::getLinkedTaskIds());
		echo json_encode(array_values($tasks),JSON_UNESCAPED_UNICODE);
	}

	public function action_get(){
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TASK_ID);

		$ids = static::getLinkedTaskIds();
		array_unshift($ids,$id);
		$tasks = static::loadTasksByIds($ids);
		if (!isset($tasks[$id]))
			router::haltJson("Error loading Task");
		echo json_encode(array_values($tasks),JSON_UNESCAPED_UNICODE);
	}

	function action_update() {
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TASK_ID);

		$userID=CUser::GetID();

		$oTaskItem=new CTaskItem($id,$userID);
		$arTask=$oTaskItem->GetData();


		if ($responsible=router::getRoute(null,'user')) {
			$oTaskItem->Update(['RESPONSIBLE_ID'=>$responsible]);
			if (in_array($responsible,$arTask['ACCOMPLICES'])) {
				$accomplices=$arTask['ACCOMPLICES'];
				unset($accomplices[array_search($responsible,$accomplices)]);
				$accomplices[]=$arTask['RESPONSIBLE_ID'];
				$oTaskItem->Update(['ACCOMPLICES'=>$accomplices]);
			}
		}
		$deadline=router::getRoute('##UNSET','deadline');
		if ($deadline!=='##UNSET') {
			if ($deadline=='null' || !$deadline) {
				$deadline='';
			} else {
				$deadline=date('d.m.Y',$deadline).' 17:00:00';
			}
			//echo $deadline;
			$oTaskItem->Update(['DEADLINE'=>$deadline]);
		}

		if ($status=router::getRoute(null,'status')) {
			$oTaskItem->Update(['STATUS'=>$status]);
		}

		if ($sorting=router::getRoute(null,'sorting')) {
			$oTaskItem->Update(['XML_ID' => $sorting]);
		}

		echo '{"result":"ok","id":'.$id.'}';
	}



	function action_create() {
		global $newTaskTemplate;

		if (!($text=router::getRoute(null,'title'))) router::haltJson('no text data');
		if (!($responsible=router::getRoute(null,'user'))) router::haltJson('no responsible');
		if (($deadline=router::getRoute(null,'deadline',-1))===-1) router::haltJson('no deadline');
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
			'ALLOW_CHANGE_DEADLINE'=>$allowMoveDeadline,
			'RESPONSIBLE_ID'=>$responsible,
			'XML_ID' => $sorting
		]);

		$obTask = new CTasks;

		if (!$taskId=$obTask->Add($data)) router::haltJson('error creating task',500,$data);

		echo '{"result":"ok","id":'.$taskId.'}';
	}

}

?>
