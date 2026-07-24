// Временный конфиг для верификации в embedded-браузере:
// как vite.config.js, но HTTP (без dev-сертификата) и без прокси-HMR.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [
					["@babel/plugin-proposal-decorators", { legacy: true }],
					["@babel/plugin-proposal-class-properties", { loose: true }],
					["@babel/plugin-proposal-private-methods", { loose: true }],
					[
						"@babel/plugin-proposal-private-property-in-object",
						{ loose: true },
					],
				],
			},
		}),
	],
	resolve: {
		alias: {
			Components: path.resolve(__dirname, "./src/Components"),
			Data: path.resolve(__dirname, "./src/Data"),
			Helpers: path.resolve(__dirname, "./src/Helpers"),
			Themes: path.resolve(__dirname, "./src/Themes"),
			Vendor: path.resolve(__dirname, "./src/Vendor"),
			"Data/Models": path.resolve(__dirname, "./src/Data/Models"),
			"config.priv": path.resolve(__dirname, "./src/config.priv.jsx"),
		},
	},
	server: {
		port: 3132,
		host: true,
	},
	publicDir: "public",
	base: "/reviakin/z2/",
});
