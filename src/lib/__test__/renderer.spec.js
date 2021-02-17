/*eslint-env jest*/
'use strict';
const { DATACACHE } = require('../constants');
const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/renderer', () => {
	let logger;
	let clientConfig;
	let nodeConfigAsClientConfig;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		clientConfig = jest.fn(() => ({}));
		nodeConfigAsClientConfig = jest.fn(() => ({}));

		jest.doMock('../config', () => ({
			clientConfig,
			nodeConfigAsClientConfig,
		}));
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('exports a function to get/make the renderer', () => {
		const { getPageRenderer } = require('../renderer');
		expect(getPageRenderer).toEqual(expect.any(Function));

		const renderer = getPageRenderer();
		expect(renderer).toEqual(expect.any(Function));
	});

	test('renderer: calls app.render twice to pre-flight network calls', async () => {
		const { getPageRenderer } = require('../renderer');
		const config = {};
		const serialize = jest.fn(() => 'testHTML');
		const datacache = {
			getForContext: jest.fn(() => ({ serialize })),
		};
		const render = jest.fn(() => 'TestApp');
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester',
			waitForPending: jest.fn(),
			[DATACACHE]: datacache,
		};

		const res = {
			end: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
		};
		const next = jest.fn();

		const renderer = getPageRenderer({ appId, basepath }, config, render);
		expect(renderer).toEqual(expect.any(Function));

		await renderer(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.end).not.toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();

		expect(req.waitForPending).toHaveBeenCalledTimes(1);
		expect(req.waitForPending).toHaveBeenCalledWith(5 * 60000);

		expect(clientConfig).toHaveBeenCalledTimes(1);
		expect(clientConfig).toHaveBeenCalledWith(
			config,
			req.username,
			appId,
			req
		);

		expect(nodeConfigAsClientConfig).toHaveBeenCalledTimes(1);
		expect(nodeConfigAsClientConfig).toHaveBeenCalledWith(
			config,
			appId,
			req
		);

		expect(render).toHaveBeenCalledTimes(2);
		expect(render).toHaveBeenCalledWith(
			basepath,
			req,
			expect.any(Object),
			expect.any(Function)
		);
		expect(render).toHaveBeenCalledWith(basepath, req, expect.any(Object));
	});

	test('renderer: not-found', async () => {
		const { getPageRenderer } = require('../renderer');
		const config = {};
		const serialize = jest.fn(() => 'testHTML');
		const datacache = {
			getForContext: jest.fn(() => ({ serialize })),
		};
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester',
			[DATACACHE]: datacache,
		};

		const o = {
			render(a, b, c, markNotFound) {
				if (markNotFound) {
					markNotFound();
				}
				return 'Not Found HTML';
			},
		};

		jest.spyOn(o, 'render');

		const res = {
			end: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
		};
		const next = jest.fn();

		const renderer = getPageRenderer({ appId, basepath }, config, o.render);
		expect(renderer).toEqual(expect.any(Function));

		await renderer(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.end).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(404);

		expect(o.render).toHaveBeenCalledTwice;
	});

	test('renderer: Error Thrown', async () => {
		const { getPageRenderer } = require('../renderer');
		const config = {};
		const serialize = jest.fn(() => 'testHTML');
		const datacache = {
			getForContext: jest.fn(() => ({ serialize })),
		};
		const next = jest.fn();
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester',
			[DATACACHE]: datacache,
		};
		const err = new Error('Ooops');

		const render = jest.fn(() => {
			throw err;
		});

		const res = {
			end: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
		};

		const renderer = getPageRenderer({ appId, basepath }, config, render);
		expect(renderer).toEqual(expect.any(Function));

		await renderer(req, res, next);

		expect(next).toHaveBeenCalledWith(err);
		expect(res.end).not.toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();

		expect(render).toHaveBeenCalledTimes(1);
	});
});
