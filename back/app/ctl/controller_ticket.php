<?php
/*
 * Поиск тикетов
 */

class controller_ticket {
	const MSG_OK='OK';
	const MSG_NO_FROM='NO_FROM_SET';
	const MSG_NO_TO='NO_TO_SET';
	const MSG_NO_USERS='NO_USER_LIST_SET';
	const MSG_NO_JOB_ID='NO_JOB_ID_SET';
	const MSG_NO_TICKET_ID='NO_TICKET_ID_SET';
	const MSG_NO_TITLE='NO_TITLE_SET';
	const MSG_NO_OWNER='NO_OWNER_SET';
	const MSG_NO_RESPONSIBLE='NO_RESPONSIBLE_SET';
	
	static public $fieldsMap = [
		'ID',
		'RESPONSIBLE_USER_ID',
		'LAMP',
		'STATUS_NAME',
		'DEADLINE_SOURCE_DATE',
		'HOLD_ON',
		'LAST_MESSAGE_BY_SUPPORT_TEAM',
		'LAST_MESSAGE_DATE',
		'OWNER_NAME',
		'TITLE',
		'DATE_CLOSE',
		'DATE_CREATE',
	];



/*	static private function loadTicketsByIds(array $ids) {
		//$ids = array_values(array_filter(array_unique(array_map('intval', $ids))));
		if (empty($ids)) return [];
		$tickets=[];
		foreach($ids as $id) {
			$rsTicket = CTicket::GetByID($id);
			if ($arTicket = $rsTicket->GetNext())
				$tickets[]=$id;
		}
		return $tickets;
	}*/

	static private function loadTicketsByIds(array $ids)
	{
	    $ids = array_values(array_unique(array_map('intval', $ids)));
	    if (!$ids) return [];

	    $tickets = [];

	    foreach ($ids as $id) {
	        $rs = CTicket::GetList(
	            $by = 's_id',
	            $order = 'asc',
	            ['ID' => $id, 'ID_EXACT_MATCH' => 'Y'],
	            $is_filtered = true,
	            'N'
	        );

	        if ($ticket = $rs->GetNext()) {
	            $tickets[$ticket['ID']] = $ticket;
	        }
	    }

	    return $tickets;
	}

	/**
	 * загружает работы переданных пользователей за указанный период
	 */
	static public function loadPeriodUsers($from,$to,$users){
		//смещаем на часовой пояс
		//$to-=3600*3;
		//$from-=3600*3;
		$to=(int)$to;

		//https://dev.1c-bitrix.ru/api_help/support/classes/cticket/getlist.php
		$closed=["DATE_CLOSE_1" => date('d.m.Y',$from)];

		if ($to)
			$closed['DATE_CLOSE_2'] = date('d.m.Y',$to);
		else
			$closed['DATE_CLOSE_2'] = date('d.m.Y',time()+86400);

			//TODO: закрытые ищем неправильно, если тикет закрыт, то датой считается - дата последнего сообщения

		//echo $from.' - '.$to;

		$open=["CLOSE" => 'N',"HOLD_ON" => 'N'];

		$delayed=["CLOSE" => 'N',"HOLD_ON" => 'Y'];

		if ($from<=time()) {
			if ($to==0) {
				$filters=[
					$closed,
					$open,
					$delayed
				];
			} elseif ($to>=time()) {
				$filters=[
					$closed,
					$open,
				];

			} else {
				$filters=[
					$closed
				];
			}
		} elseif(!$to) {
			$filters=[
				$delayed,
			];
		} else return [];


		$by = "s_id";                   // обязательно используем переменные,
		$order = "asc";                 // т.к. константы в параметрах работать не будут

		$is_filtered=true;//https://dev.1c-bitrix.ru/api_help/support/classes/cticket/getlist.php
		$tickets=[];
		foreach ($users as $user) {
			foreach ($filters as $filter) {
				$filter["RESPONSIBLE_ID"] = $user;
				//var_dump($filter);
				$rs = CTicket::GetList($by, $order, $filter, $is_filtered,'N');

				while ($ticket = $rs->GetNext())
					$tickets[] = [
						'ID'=>$ticket['ID'],
						'RESPONSIBLE_USER_ID'=>$ticket['RESPONSIBLE_USER_ID'],
						'LAMP'=>$ticket['LAMP'],
						'DATE_CREATE'=>$ticket['DATE_CREATE'],
						'STATUS_NAME'=>$ticket['STATUS_NAME'],
						'LAST_MESSAGE_USER_ID'=>$ticket['LAST_MESSAGE_USER_ID'],
						'LAST_MESSAGE_DATE'=>$ticket['LAST_MESSAGE_DATE'],
						'DATE_CLOSE'=>$ticket['DATE_CLOSE'],
						'DEADLINE_SOURCE_DATE'=>$ticket['DEADLINE_SOURCE_DATE'],
						'OWNER_NAME'=>$ticket['OWNER_NAME'],
						'OWNER_USER_ID'=>$ticket['OWNER_USER_ID'],
						'LAST_MESSAGE_BY_SUPPORT_TEAM'=>$ticket['LAST_MESSAGE_BY_SUPPORT_TEAM'],
						'TITLE'=>$ticket['TITLE'],
						'HOLD_ON'=>$ticket['HOLD_ON']
					];

				unset($rs);
			}
		}
		//var_dump($tickets);
		return $tickets;

	}
	
	public function action_load(){
		if (is_null($from=router::getRoute(3, 'from')))
			router::haltJson(static::MSG_NO_FROM);

		if (is_null($to=router::getRoute(4, 'to')))
			router::haltJson(static::MSG_NO_TO);
		if ($to=='null') $to=null; //открытый конец


		if (is_null($users= router::getRoute(5, 'users')))
			router::haltJson(static::MSG_NO_USERS);

		$byIds=router::getIds();
		$result = [];
		$tickets = static::loadPeriodUsers($from, $to, explode(',',$users));
		foreach ($tickets as $ticket) {
			$id=(int)$ticket['ID'];
			$result[$id] = $ticket;
			if (in_array($id,$byIds)) unset($byIds[$id]);
		}

		$linkedTickets = static::loadTicketsByIds($byIds);
		foreach ($linkedTickets as $ticket) {
			$id=(int)$ticket['ID'];
			$result[$id] = $ticket;
		}
		echo json_encode(array_values($result),JSON_UNESCAPED_UNICODE);
	}

	public function action_linked(){
		// Возвращаем только объекты из ids, без фильтра по периодам/пользователям
		$ids=router::getIds();
		$tickets = static::loadTicketsByIds($ids);
		echo json_encode(array_values($tickets),JSON_UNESCAPED_UNICODE);
	}

	public function action_get(){
		if (is_null($id=router::getRoute(3, 'id')))
			router::haltJson(static::MSG_NO_TICKET_ID);

		$ids = router::getIds();
		array_unshift($ids, $id);
		$tickets = static::loadTicketsByIds($ids);
		if (!isset($tickets[$id]))
			router::haltJson("Error loading Ticket");
		echo json_encode(array_values($tickets),JSON_UNESCAPED_UNICODE);
	}

	/**
	 * Создание новой заявки (тикета)
	 * 
	 * Параметры:
	 * - text: текст (первая строка - заголовок, остальные - сообщение)
	 * - owner: ID автора заявки (OWNER_USER_ID)
	 * - responsible: ID ответственного (RESPONSIBLE_USER_ID)
	 */
	function action_create() {
		// Получаем параметры
		$text = router::getRoute(null, 'text');
		if (!$text) router::haltJson(static::MSG_NO_TITLE);
		
		$owner = router::getRoute(null, 'owner');
		if (!$owner) router::haltJson(static::MSG_NO_OWNER);
		
		$responsible = router::getRoute(null, 'responsible');
		if (!$responsible) router::haltJson(static::MSG_NO_RESPONSIBLE);
		
		// Разбираем текст на заголовок и сообщение
		$lines = explode("\n", $text);
		$title = $lines[0];
		$message = count($lines) > 1 ? implode("\n", array_slice($lines, 1)) : '';
		
		// Данные тикета
		// SITE_ID, CATEGORY_ID, SLA_ID задаются константами в начале файла
		// или можно получать их из параметров
		$arFields = [
			'SITE_ID' => defined('TICKET_SITE_ID') ? TICKET_SITE_ID : 's1',
			'CATEGORY_ID' => defined('TICKET_CATEGORY_ID') ? TICKET_CATEGORY_ID : 43,
			'SLA_ID' => defined('TICKET_SLA_ID') ? TICKET_SLA_ID : 1,
			'OWNER_USER_ID' => $owner,
			'TITLE' => $title,
			'MESSAGE' => $message,
			'RESPONSIBLE_USER_ID' => $responsible,
			'SOURCE_ID' => 0,
		];
		
		$MESSAGE_ID = 0;
		$NEW_TICKET_ID = CTicket::Set($arFields, $MESSAGE_ID, 0, "N");
		
		if (!$NEW_TICKET_ID) {
			router::haltJson('error creating ticket', 500);
		}
		
		echo '{"result":"ok","id":'.$NEW_TICKET_ID.'}';
	}

}

?>
