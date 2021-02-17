/*eslint-env jest*/
'use strict';

describe('lib/api/endpoints/index', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('endpoint index registers all the endpoints', () => {
		const registerEndpoint = jest.fn();
		const m = { default: registerEndpoint };
		jest.doMock('../health-check', () => m);
		jest.doMock('../user-agreement', () => m);
		jest.doMock('../ugd/context-data', () => m);
		jest.doMock('../videos', () => m);
		const register = require('../index');

		expect(() => register(1, 2, () => {})).not.toThrow();
		expect(registerEndpoint).toHaveBeenCalledTimes(4);
		expect(registerEndpoint).toHaveBeenCalledWith(
			1,
			2,
			expect.any(Function)
		);
	});
});
