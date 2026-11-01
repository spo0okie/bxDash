/** Проверяет PHP-точку входа с подставными старым и новым API без живого портала. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const entry = path.resolve(__dirname, '../public/index.php');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bxdash-portal-'));

/** Создаёт изолированный портал и выполняет точку входа отдельным PHP-процессом. */
function runScenario(name, modern, config) {
	const root = path.join(temp, name);
	const includeDir = path.join(root, 'bitrix/modules/main/include');
	fs.mkdirSync(includeDir, { recursive: true });
	fs.copyFileSync(entry, path.join(root, 'index.php'));
	fs.writeFileSync(path.join(root, 'index.html'), '<html><head><script type="module" src="app.js"></script></head><body></body></html>');
	if (config) fs.writeFileSync(path.join(root, 'portal.config.php'), '<?php return ' + config + ';');
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
	class CJSCore { static function Init($items) { $GLOBALS['calls']['core'] = $items; } }
	class PortalApplication {
		function AddHeadScript($src) { $GLOBALS['calls']['scripts'][] = $src; }
		function ShowCSS() { echo '<link data-portal-css>'; }
		function ShowHeadStrings() { echo '<script>window.BX = function(){}; BX.ready = function(){};</script>'; }
		function ShowHeadScripts() { echo '<script src="portal.js"></script>'; }
	}
	$APPLICATION = new PortalApplication();
}
`);
	fs.writeFileSync(path.join(includeDir, 'epilog_after.php'), '<?php echo "\\nCALLS:" . json_encode($GLOBALS["calls"]);');
	const phpRoot = root.replaceAll('\\', '/').replaceAll("'", "\\'");
	const output = execFileSync('php', ['-r', `$_SERVER['DOCUMENT_ROOT']='${phpRoot}'; require '${phpRoot}/index.php';`], { encoding: 'utf8' });
	return { output, calls: output.includes('CALLS:') ? JSON.parse(output.split('CALLS:')[1]) : null };
}

try {
	const legacy = runScenario('legacy-auto', false);
	assert(legacy.calls.core.includes('popup'));
	assert(legacy.calls.core.includes('autosave'));
	assert(!legacy.calls.modern);
	assert(legacy.output.indexOf('portal.js') < legacy.output.indexOf('app.js'));
	assert(legacy.output.includes('window.__BXDASH_PORTAL__ = true'));
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
	assert(unavailable.output.includes('недоступный профиль'));
	console.log('OK: 5 сценариев PHP portal (подставные API, не проверка живого Bitrix)');
} finally {
	// Удаляем только созданный этим тестом временный каталог.
	fs.rmSync(temp, { recursive: true, force: true });
}
