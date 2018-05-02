/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/api-proxy (middleware)', () => {

	let logger;

	const config = Object.freeze({
		'proxy': 'http://test'
	});

	beforeEach(() => {
		jest.resetModules();

		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'error');
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('exports a middleware function factory', () => {
		const fn = require('../api-proxy');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(1);
	});

	test ('the middleware function throws if proxy middleware is not available', () => {
		jest.doMock('http-proxy-middleware', () => {
			throw new Error('Cannot find module. (mock)');
		});
		const fn = require('../api-proxy');

		expect(() => fn(config)).toThrow();

		expect(logger.error).toHaveBeenCalled();
	});

	test ('the middleware function sets proxy', () => {
		const httpProxyMiddleware = jest.fn(() => 'http-proxy-middleware');

		jest.doMock('http-proxy-middleware', () => httpProxyMiddleware);

		const fn = require('../api-proxy');

		expect(() => fn(config)).not.toThrow();

		expect(logger.error).not.toHaveBeenCalled();

		expect(httpProxyMiddleware).toHaveBeenCalledWith(
			expect.objectContaining({
				'changeOrigin': true,
				'target': config.proxy
			})
		);
	});
});
