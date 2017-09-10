/*eslint-env jest*/
'use strict';

describe('lib/cors (middleware)', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('exports a middleware function', () => {
		const fn = require('../cors');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);
	});


	test ('the middleware function calls next()', () => {
		const fn = require('../cors');
		const next = jest.fn();
		const res = {setHeader: jest.fn()};

		expect(() => fn(null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});


	test ('the middleware function sets cors headers on the response', () => {
		const next = () => ({});
		const fn = require('../cors');
		const res = {setHeader: jest.fn()};

		expect(() => fn(null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.setHeader).toHaveBeenCalledTimes(2);
		expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
		expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'X-Requested-With');
	});

});
