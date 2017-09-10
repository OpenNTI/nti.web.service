/*eslint-env jest*/
'use strict';


describe('lib/no-cache (middleware)', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('exports a middleware function', () => {
		const fn = require('../no-cache');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);
	});


	test ('the middleware function calls next()', () => {
		const fn = require('../no-cache');
		const next = jest.fn();
		const res = {setHeader: jest.fn()};

		expect(() => fn(null, res, next)).not.toThrow();
		expect(fn(null, res, jest.fn())).toEqual(void 0);

		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});


	test ('the middleware function sets no-cache headers on the response', () => {
		const next = () => ({});
		const fn = require('../no-cache');
		const res = {setHeader: jest.fn()};

		expect(() => fn(null, res, next)).not.toThrow();


		expect(res.setHeader).toHaveBeenCalledTimes(3);
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache, no-store, ' +
													'must-revalidate, max-stale=0, ' +
													'post-check=0, pre-check=0');
		expect(res.setHeader).toHaveBeenCalledWith('Expires', '-1');
		expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
	});


	test ('does not call setHeader if headers already sent.', () => {
		const next = () => ({});
		const fn = require('../no-cache');
		const res = {headersSent: true, setHeader: jest.fn()};

		expect(() => fn(null, res, next)).not.toThrow();

		expect(res.setHeader).not.toHaveBeenCalled();
	});

});
