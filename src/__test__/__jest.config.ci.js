const {jest} = require('../../package.json') || {};

module.exports = Object.assign(jest || {}, {
	collectCoverage: true,
	collectCoverageFrom: ['src/**/*.{js,jsx}','!**/*.spec.js'],
	coverageDirectory: 'reports/coverage',
	coverageReporters: process.env.CI ? [
		'text-summary',
		'lcov',
		'cobertura'
	] : ['text-summary'],
	testPathIgnorePatterns: [
		'<rootDir>[/\\\\](build|docs|node_modules|scripts)[/\\\\]',
	],
	testResultsProcessor: process.env.CI ? './node_modules/jest-junit' : void 0,
});
