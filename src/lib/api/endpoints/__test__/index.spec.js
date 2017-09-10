/*eslint-env jest*/
'use strict';


describe ('lib/api/endpoints/index', () => {

	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.resetModules();
	});

	test ('endpoint index registers all the endpoints', () => {
		const registerEndpoint = jest.fn();
		const m = {default: registerEndpoint};
		jest.doMock('../health-check', () => m);
		jest.doMock('../user-agreement', () => m);
		jest.doMock('../ugd/context-data', () => m);
		const register = require('../index');

		expect(() => register(1, 2, 3)).not.toThrow();
		expect(registerEndpoint).toHaveBeenCalledTimes(3);
		expect(registerEndpoint).toHaveBeenCalledWith(1, 2, 3);
	});
});
