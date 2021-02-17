/*eslint-env jest*/
'use strict';

describe('lib/frame-options (middleware)', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('exports a middleware function', () => {
		const fn = require('../frame-options');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);
	});

	test('the middleware function calls next()', () => {
		const fn = require('../frame-options');
		const next = jest.fn();
		const res = { setHeader: jest.fn() };

		expect(() => fn(null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});

	test('the middleware function sets frame-options headers on the response', () => {
		const next = () => ({});
		const fn = require('../frame-options');
		const res = { setHeader: jest.fn() };

		expect(() => fn(null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.setHeader).toHaveBeenCalledTimes(1);
		expect(res.setHeader).toHaveBeenCalledWith(
			'X-Frame-Options',
			'SAMEORIGIN'
		);
	});
});
