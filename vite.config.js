import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Чтение SSL сертификатов
let httpsConfig;
try {
	httpsConfig = {
		cert: fs.readFileSync('./dev/cert.cer'),
		key: fs.readFileSync('./dev/cert.key'),
	};
} catch (e) {
	httpsConfig = false;
}

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [
					['@babel/plugin-proposal-decorators', { legacy: true }],
					['@babel/plugin-proposal-class-properties', { loose: true }],
					['@babel/plugin-proposal-private-methods', { loose: true }],
					['@babel/plugin-proposal-private-property-in-object', { loose: true }],
				],
			},
		}),
	],
	resolve: {
		alias: {
			Components: path.resolve(__dirname, './src/Components'),
			Data: path.resolve(__dirname, './src/Data'),
			Helpers: path.resolve(__dirname, './src/Helpers'),
			// Алиас для модуля-обёртки, который читает window.__CONFIG__
			'config.priv': path.resolve(__dirname, './src/config.priv.jsx'),
		},
	},
	server: {
		port: 3030,
		https: httpsConfig,
		host: true,
	},
	build: {
		outDir: 'build',
		sourcemap: true,
		minify: 'esbuild',
	},
	publicDir: 'public',
    base: '/reviakin/z2/'
});
