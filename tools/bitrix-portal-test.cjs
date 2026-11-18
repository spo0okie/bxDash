/** Проверяет маршрут ресурсов с подставными старым и новым Bitrix. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const back = path.resolve(__dirname, '../back');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bxdash-portal-'));

/** Создаёт изолированный портал и выполняет маршрут через штатный api.php. */
function runScenario(name, modern, config, authorized = true) {
	const root = path.join(temp, name);
	const includeDir = path.join(root, 'bitrix/modules/main/include');
	fs.mkdirSync(includeDir, { recursive: true });
	const apiDir = path.join(root, 'fixture/back');
	fs.mkdirSync(path.join(apiDir, 'app/ctl'), { recursive: true });
	for (const file of ['api.php', 'app/router.php', 'app/ctl/controller_portal.php']) {
		fs.copyFileSync(path.join(back, file), path.join(apiDir, file));
	}
	fs.writeFileSync(path.join(apiDir, 'conf.php'), `<?php define('BXDASH_TIMEZONE', 'UTC'); $bitrixResources = ${config || 'array()'};`);
	fs.writeFileSync(path.join(includeDir, '../bx_root.php'), '<?php');
	if (modern) {
		for (const name of ['popup', 'date']) {
			const dir = path.join(root, 'bitrix/js/main', name);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, 'config.php'), '<?php return array();');
		}
	}
	// API fixture намеренно не эмулирует работу JS: только контракт регистрации/вывода.
	const modernApi = modern ? 'namespace Bitrix\\Main\\UI { class Extension { static function load($items) { $GLOBALS["calls"]["modern"] = $items; } } }' : '';
	fs.writeFileSync(path.join(includeDir, 'prolog_before.php'), `<?php
${modernApi}
namespace {
	$GLOBALS['calls'] = array();
	date_default_timezone_set('UTC');
	class CModule { static function IncludeModule($name) {} }
	class CTimeZone { static function Disable() {} }
	class PortalUser { function IsAuthorized() { return ${authorized ? 'true' : 'false'}; } }
	class CJSCore { static function Init($items) { $GLOBALS['calls']['core'] = $items; } }
	class PortalApplication {
		function AddHeadScript($src) { $GLOBALS['calls']['scripts'][] = $src; }
		function ShowCSS() { echo '<link data-portal-css>'; }
		function ShowHeadStrings() { echo '<script>window.BX = function(){}; BX.ready = function(){};</script>'; }
		function ShowHeadScripts() { echo '<script src="portal.js"></script>'; }
		function ShowBodyScripts() { echo '<script src="portal-body.js"></script>'; }
	}
	$APPLICATION = new PortalApplication();
	$USER = new PortalUser();
}
`);
	fs.writeFileSync(path.join(includeDir, 'epilog_after.php'), '<?php echo "\\nCALLS:" . json_encode($GLOBALS["calls"]);');
	const phpRoot = root.replaceAll('\\', '/').replaceAll("'", "\\'");
	const output = execFileSync('php', ['-r', `$_SERVER['DOCUMENT_ROOT']='${phpRoot}'; $_SERVER['REQUEST_METHOD']='GET'; $_SERVER['REQUEST_URI']='/fixture/back/api/portal/resources'; require 'api.php';`], { cwd: apiDir, encoding: 'utf8' });
	return { output, calls: output.includes('CALLS:') ? JSON.parse(output.split('CALLS:')[1]) : null };
}

try {
	const legacy = runScenario('legacy-auto', false);
	assert(legacy.calls.core.includes('popup'));
	assert(legacy.calls.core.includes('autosave'));
	assert(!legacy.calls.modern);
	const modern = runScenario('modern-auto', true);
	assert.deepEqual(modern.calls.modern, ['main.core', 'main.popup', 'main.date']);
	assert.deepEqual(modern.calls.core, ['sidepanel']);
	assert(!modern.calls.scripts);
	const forced = runScenario('forced-legacy', true, "array('profile'=>'legacy', 'extensions'=>array('popup'), 'scripts'=>array())");
	assert.deepEqual(forced.calls.core, ['popup']);
	assert(!forced.calls.modern);
	const custom = runScenario('custom-modern', true, "array('extensions'=>array('main.core'), 'coreExtensions'=>array('ajax'), 'scripts'=>array('/custom.js'))");
	assert.deepEqual(custom.calls.modern, ['main.core']);
	assert.deepEqual(custom.calls.core, ['ajax']);
	assert.deepEqual(custom.calls.scripts, ['/custom.js']);
	const unavailable = runScenario('unavailable-modern', false, "array('profile'=>'modern')");
	assert.equal(unavailable.calls, null);
	assert(unavailable.output.includes('Недоступный профиль'));
	const anonymous = runScenario('anonymous', true, undefined, false);
	assert.equal(anonymous.calls, null);
	assert(JSON.parse(anonymous.output).error.includes('Требуется авторизация'));
	for (const assets of [legacy, modern]) {
		assert(assets.output.includes('name="bxdash-portal-assets"'));
		assert(assets.output.includes('data-portal-css'));
		assert(assets.output.includes('BX.ready'));
		assert.match(assets.output, /portal\.js.*<body>.*portal-body\.js/s);
		assert(!assets.output.includes('app.js'));
	}
	console.log('OK: 6 сценариев GET portal/resources с подставным Bitrix');
} finally {
	// Удаляем только созданный этим тестом временный каталог.
	fs.rmSync(temp, { recursive: true, force: true });
}
