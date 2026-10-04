// Поиск необъявленных идентификаторов в src (сборка Vite идёт без ESLint и их не ловит).
// Запуск: node tools/check-undeclared.cjs [файл ...]   — без аргументов проверяет весь src.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const KNOWN = new Set([
	'window', 'document', 'console', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'Promise', 'Object', 'Array', 'Number', 'String', 'Boolean', 'Math', 'Date', 'JSON', 'Map', 'Set', 'WeakMap',
	'Error', 'TypeError', 'RegExp', 'Symbol', 'undefined', 'NaN', 'Infinity', 'isNaN', 'parseInt', 'parseFloat',
	'encodeURIComponent', 'decodeURIComponent', 'AbortController', 'WebSocket', 'URL', 'URLSearchParams',
	'navigator', 'location', 'localStorage', 'sessionStorage', 'requestAnimationFrame', 'cancelAnimationFrame',
	'queueMicrotask', 'Audio', 'Image', 'Blob', 'FormData', 'Headers', 'Event', 'CustomEvent', 'ResizeObserver',
	'MutationObserver', 'IntersectionObserver', 'getComputedStyle', 'alert', 'confirm', 'globalThis', 'Intl',
	'process', 'require', 'module', 'exports', 'global', 'Reflect', 'structuredClone', 'btoa', 'atob', 'performance',
	'Function', '__dirname', '__filename', 'jest', 'describe', 'test', 'it', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'arguments',
]);

function walk(dir, out) {
	fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) { if (entry.name !== 'Vendor' && entry.name !== 'node_modules') walk(full, out); }
		else if (/\.(jsx?|cjs|mjs)$/.test(entry.name)) out.push(full);
	});
	return out;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : walk('src', []);
let found = 0;
files.forEach(file => {
	let ast;
	try {
		ast = parser.parse(fs.readFileSync(file, 'utf8'), {
			sourceType: 'module',
			plugins: ['jsx', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
		});
	} catch (e) {
		console.log(file + ': не разобран: ' + e.message);
		found++;
		return;
	}
	traverse(ast, {
		Program(programPath) {
			Object.entries(programPath.scope.globals).forEach(([name, node]) => {
				if (KNOWN.has(name)) return;
				found++;
				console.log(file + ':' + (node.loc ? node.loc.start.line : '?') + '  ' + name);
			});
		},
	});
});
console.log(found ? 'необъявленных: ' + found : 'необъявленных идентификаторов нет (' + files.length + ' файлов)');
process.exit(found ? 1 : 0);
