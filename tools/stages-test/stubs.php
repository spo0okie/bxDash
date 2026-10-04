<?php
// Заглушки Битрикса для локальной проверки провайдера стадий на временной базе MySQL.
const TEST_DB = 'bxdash_stage_tmp_test';

class FakeResult {
	private $res;
	function __construct($res) { $this->res = $res; }
	function Fetch() { return is_object($this->res) ? ($this->res->fetch_assoc() ?: false) : false; }
}

class FakeDB {
	public $db_Error = '';
	public $m;
	public $log = [];
	function __construct() {
		mysqli_report(MYSQLI_REPORT_OFF);
		$this->m = new mysqli('127.0.0.1', 'root', '', null, 3306);
		$this->m->set_charset('utf8mb4');
	}
	function Query($sql, $ignore = false) {
		$this->log[] = $sql;
		$res = $this->m->query($sql);
		if ($res === false) { $this->db_Error = $this->m->error; return false; }
		return new FakeResult($res);
	}
	function ForSql($v) { return $this->m->real_escape_string((string)$v); }
	function LastID() { return $this->m->insert_id; }
}

class FakeUser {
	public $auth = true;
	function IsAuthorized() { return $this->auth; }
}

class CUser {
	static function GetByID($id) {
		$exists = in_array((int)$id, [1, 2, 3], true);
		return new class($exists) {
			private $e;
			function __construct($e) { $this->e = $e; }
			function Fetch() { $r = $this->e ? ['ID' => 1] : false; $this->e = false; return $r; }
		};
	}
}

$DB = new FakeDB();
$USER = new FakeUser();
