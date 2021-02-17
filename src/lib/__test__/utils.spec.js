/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/utils', () => {
	jest.useFakeTimers();

	beforeEach(() => {
		jest.resetModules();
		const logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('getStackOrMessage()', () => {
		const { getStackOrMessage } = require('../utils');

		expect(
			getStackOrMessage({ stack: 'stack', message: 'message' })
		).toEqual('stack');
		expect(getStackOrMessage({ message: 'message' })).toEqual('message');
		expect(getStackOrMessage('foo')).toEqual('foo');
	});

	test('callThresholdMet()', async () => {
		function foo() {}

		const { callThresholdMet } = require('../utils');

		expect(callThresholdMet(foo, 3)).toBe(false);
		expect(callThresholdMet(foo, 3)).toBe(false);
		expect(callThresholdMet(foo, 3)).toBe(false);
		expect(callThresholdMet(foo, 3)).toBe(true);

		jest.runAllTimers();

		expect(callThresholdMet(foo, 3)).toBe(false);
		expect(callThresholdMet(foo, 3)).toBe(false);
		expect(callThresholdMet(foo, 3)).toBe(false);
		jest.runAllTimers();
		expect(callThresholdMet(foo, 3)).toBe(false);
	});
});
