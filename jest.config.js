// Конфигурация Jest для проекта bxDash
export default {
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/src/setupTests.jsx'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^Components/(.*)$': '<rootDir>/src/Components/$1',
		'^Data/(.*)$': '<rootDir>/src/Data/$1',
		'^Helpers/(.*)$': '<rootDir>/src/Helpers/$1',
		'^Themes/(.*)$': '<rootDir>/src/Themes/$1',
		'^Vendor/(.*)$': '<rootDir>/src/Vendor/$1',
		'^config\\.priv$': '<rootDir>/src/config.priv.jsx',
		'\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
	},
	testMatch: [
		'<rootDir>/src/**/__tests__/**/*.{js,jsx}',
		'<rootDir>/src/**/*.{test,spec}.{js,jsx}'
	],
	collectCoverageFrom: [
		'src/**/*.{js,jsx}',
		'!src/index.js',
		'!src/reportWebVitals.js',
		'!src/config.priv.js'
	],
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70
		}
	},
	transformIgnorePatterns: [
		'node_modules/(?!(antd|@atlaskit)/)'
	],
	transform: {
		'^.+\\.(js|jsx)$': 'babel-jest',
	},
};
