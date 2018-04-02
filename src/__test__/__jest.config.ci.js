const path = require('path');

const {jest} = require('../../package.json') || {};

process.env.JEST_JUNIT_OUTPUT = 'reports/test-results/index.xml';

module.exports = Object.assign(jest || {}, {
	collectCoverage: Boolean(process.env.CI),
	collectCoverageFrom: ['src/**/*.{js}','!**/*.spec.js', '!**/__test__/**.js'],
	coverageDirectory: 'reports/coverage',
	coverageReporters: process.env.CI ? [
		'text-summary',
		'lcov',
		'cobertura'
	] : ['text-summary'],
	roots: ['<rootDir>', '<rootDir>/src/'],
	rootDir: path.resolve(__dirname, '../..'),
	testResultsProcessor: process.env.CI ? './node_modules/jest-junit' : void 0,
});
