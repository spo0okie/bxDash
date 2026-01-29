<?php
/*
 * Класс инициации исходящих звонков в астериске
 */

class controller_memo {
	const MSG_OK='OK';
	const MSG_NO_ID='NO_ID_SET';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_ITEM_ID='NO_ITEM_ID_SET';

	static public $fieldsMap = [
		'ID',
		'DATE_ACTIVE_FROM',
		'DATE_ACTIVE_TO',
		'CREATED_DATE',
		'SORT',
		'~DETAIL_TEXT',
	];

	static public function deleteItem($id) {
		return CIBlockElement::Delete($id);
	}

	static public function updateItem($id,$data) {
		global $USER;
		if (!isset($data['MODIFIED_BY']))
			$data['MODIFIED_BY']=$USER->GetID();

		$el = new CIBlockElement;

		return $el->Update($id, $data);
	}

	static public function createItem($data) {
		global $USER;
		if (!isset($data['CREATED_BY']))
			$data['CREATED_BY']=$USER->GetID();

		$el = new CIBlockElement;

		return $el->Add($data);
	}

	/**
	 * загружает работы переданных пользователей за указанный период
	 */
	static public function loadPeriodUsers($from,$to,$users){
		global $USER;
		//смещаем на часовой пояс
		//if ($to) $to-=3600*3;
		//$from-=3600*3;
		//error_log('loadPeriodUsers:'.ConvertTimeStamp($from, "FULL"));
		//error_log('loadPeriodUsers:'.ConvertTimeStamp($to, "FULL"));

		$closed=[
//			'<DATE_ACTIVE_TO' => ConvertTimeStamp($to, "FULL") //в случае null не нужно
			'>=DATE_ACTIVE_TO' => ConvertTimeStamp($from, "FULL")
		];

		if ($to)
			$closed['<DATE_ACTIVE_TO'] = ConvertTimeStamp($to, "FULL");


		if ($from>time())
			$open=[
				'DATE_ACTIVE_TO' => false,
//				'<DATE_ACTIVE_FROM' => ConvertTimeStamp($to, "FULL"),
				'>=DATE_ACTIVE_FROM' => ConvertTimeStamp($from, "FULL"),
			];
		else
			$open=[
				'DATE_ACTIVE_TO' => false,
//				'<DATE_ACTIVE_FROM' => ConvertTimeStamp($to, "FULL"),
			];
		if ($to)
				$open['<DATE_ACTIVE_FROM'] = ConvertTimeStamp($to, "FULL");



		if ($to && $to<=time())
			$filter=$closed;
		elseif ($from>time()) {
			if (!$to) {
				unset($open['<DATE_ACTIVE_FROM']);
				$filter=[['LOGIC' => 'OR',$open,['DATE_ACTIVE_TO' => false,'DATE_ACTIVE_FROM' => false]]];
			}else {
				$filter=$open;

			}

		} else 
			$filter=[['LOGIC' => 'OR',$open,$closed]];


		$filter['IBLOCK_ID'] = 92;
		$filter['CREATED_BY'] = $USER->GetID();

		//var_dump($filter);
		$search = CIBlockElement::GetList(
			[],
			$filter,
			false,
			false,
			['*']	//,'PROPERTY_USER','PROPERTY_AUTHORIZED','PROPERTY_STATUS','PROPERTY_AUTHSTATUS','PROPERTY_AUTHDATE']
		);

		$items=[];

		while ($item = $search->GetNextElement()) {
			//$item->fields['PROPERTY_USER']=$user;
			$items[]=router::filterFields($item->fields,static::$fieldsMap);
		}

		return $items;
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


	function loadItem($id){
		$filter=[
			'IBLOCK_ID' => 92,
			'ID' => $id
		];

		//var_dump($filter);
		$search = CIBlockElement::GetList(
			[],
			$filter,
			false,
			false,
			['*']	//,'PROPERTY_USER','PROPERTY_AUTHORIZED','PROPERTY_STATUS','PROPERTY_AUTHSTATUS','PROPERTY_AUTHDATE']
		);

		$items=[];

		while ($item = $search->GetNextElement()) {
			$items[]=router::filterFields($item->fields,static::$fieldsMap);
		}
		return $items;
	}

	function getProperties($item,$list) {
		$properties=[];
		foreach($list as $prop) {
			$properties[$prop]=isset($item['PROPERTY_'.$prop.'_VALUE'])?$item['PROPERTY_'.$prop.'_VALUE']:null;
		}
		return $properties;
	}

	public function action_get(){
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TASK_ID);

		$items=$this->loadItem($id);
		//return $jobs;
		echo json_encode($items,JSON_UNESCAPED_UNICODE);
	}

	function action_delete() {
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_JOB_ID);

		if (!static::deleteItem($id)) router::haltJson('error updating data');

		echo '{"result":"ok"}';
	}

	function action_update() {
		global $USER;
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_JOB_ID);
		$result=['result'=>'ok'];

		$data=[];
		if (($text=router::getRoute(null,'text',-1))!==-1) {
			$data['DETAIL_TEXT_TYPE']='text';
			$data["DETAIL_TEXT"] = $text;
			//$data["NAME"] = $text;
		}

		$start=router::getRoute(null,'deadline',-1);
		$end=router::getRoute(null,'closedDate',-1);

		$result['start']=$start;
		$result['end']=$end;
		if ($start===-1||!$end===-1) {
			if ($start===-1) $start=null;
			if ($end===-1) $end=null;
			$data['DATE_ACTIVE_FROM']=$start?ConvertTimeStamp($start,'FULL'):'';
			$data['DATE_ACTIVE_TO']=$end?ConvertTimeStamp($end,'FULL'):'';
		}

/*		$items=$this->loadItem($id);
		//print_r($items);
		$properties=$this->getProperties($items[0],['USER','STATUS','AUTHSTATUS','AUTHORIZED','AUTHDATE']);

		if ($user=router::getRoute(null,'user')) {
			$properties['USER']=$user;
		}

		if (($status=router::getRoute(null,'status'))!==null) {
			$properties['STATUS']=$status;
		}

		if (($authStatus=router::getRoute(null,'authStatus'))!==null) {
			$properties['AUTHSTATUS']=$authStatus;
			$properties['AUTHDATE']=ConvertTimeStamp(time(),'FULL');
			$properties['AUTHORIZED']=$USER->getID();
		}

		//authStatus;
		//authUser;
		//comments;
*/

		if ($sort=router::getRoute(null,'sorting')) {
			$data['SORT']=$sort;
		}

/*		if (count($properties)) {
			$data['PROPERTY_VALUES']=$properties;
		}
*/
		//print_r($properties);

		if (!count($data)) router::haltJson('no data to commit');

		if (!static::updateItem($id,$data)) router::haltJson('error updating data',500,$data);

		echo '{"result":"ok","id":'.$id.'}';
		//echo json_encode($result);
	}

	function action_create() {

		if (!($text=router::getRoute(null,'text'))) router::haltJson('no text data');
		$start=router::getRoute(null,'deadline');
		$end=router::getRoute(null,'closedDate');
		if (!$start && !$end) router::haltJson('no date');

		$data=[
			'IBLOCK_ID' => 92,
			'DETAIL_TEXT_TYPE'=>'text',
			'DETAIL_TEXT'=>$text,
//			'PROPERTY_VALUES'=> ['USER'=>$user],
		];

		$data["NAME"] = explode("\n",$text)[0];

		if ((int)$start) $data['DATE_ACTIVE_FROM']=ConvertTimeStamp($start,'FULL');
		if ((int)$end) $data['DATE_ACTIVE_TO']=ConvertTimeStamp($end,'FULL');

		if ($sort=router::getRoute(null,'sorting')) {
			$data['SORT']=$sort;
		}

		if (!$id=static::createItem($data)) router::haltJson('error creating data',500,$data);

		echo '{"result":"ok","id":'.$id.'}';
	}

	public function action_event(){
		$body = file_get_contents('php://input');
		error_log(print_r($body,true));
	}
	
}

?>
