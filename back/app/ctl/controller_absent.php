<?php
/*
 * Класс инициации исходящих звонков в астериске
 */

class controller_absent {
	const MSG_OK='OK';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_JOB_ID='NO_JOB_ID_SET';

	static public $fieldsMap = [
		'ID',
		'DATE_ACTIVE_FROM',
		'DATE_ACTIVE_TO',
		'PROPERTY_USER_VALUE',
	];


	/**
	 * загружает работы переданных пользователей за указанный период
	 */
	static public function loadPeriodUsers($from,$to,$users){
		//смещаем на часовой пояс
		//if ($to) $to-=3600*3;
		//$from-=3600*3;

		$filter=['>=DATE_ACTIVE_TO' => date('d.m.Y',$from)/*ConvertTimeStamp($from, "FULL")*/];

		if ($to)
			$filter['<=DATE_ACTIVE_FROM'] = date('d.m.Y',$to);

		$filter['IBLOCK_ID'] = 3;
		$filter['PROPERTY_USER'] = $users;

		$search = CIBlockElement::GetList(
			[],
			$filter,
			false,
			false,
			['*','PROPERTY_USER']
		);

		$absents=[];

		while ($item = $search->GetNextElement()) {
			$absents[]=router::filterFields($item->fields,static::$fieldsMap);
		}

		return $absents;
	}
	
	public function action_load(){
		if (is_null($from=router::getRoute(3, 'from')))
			router::haltJson(static::MSG_NO_FROM);

		if (is_null($to=router::getRoute(4, 'to')))
			router::haltJson(static::MSG_NO_TO);
		if ($to=='null') $to=null; //открытый конец

		if (is_null($users= router::getRoute(5, 'users')))
			router::haltJson(static::MSG_NO_USERS);

		echo json_encode(static::loadPeriodUsers($from, $to,explode(',',$users)),JSON_UNESCAPED_UNICODE);
	}

}

?>
