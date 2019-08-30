/*eslint-env jest*/
'use strict';
jest.mock('fs');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('Worker', () => {
	let logger, restart;

	const fail = () => { throw new Error(); };

	beforeEach(() => {
		jest.resetModules();
		jest.dontMock('cluster');
		restart = require('../lib/restart').restart;
		logger = require('../lib/logger');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});


	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
		jest.dontMock('cluster');
	});


	test ('getApp() No Configuration', async () => {
		const {getApp} = require('../worker');

		let threw = false;

		try {
			await getApp({});
		} catch (e) {
			threw = true;
			expect(e.toString()).toMatch('No configuration');
		}

		expect(threw).toBe(true);
	});


	test ('getApp() Missing app package', async () => {
		const {getApp} = require('../worker');

		let threw = false;

		try {
			await getApp({
				server: 'foo',
				apps: [{
					package: 'does not exist',
					basepath: '/test/'
				}],
			});
		} catch (e) {
			threw = true;
			expect(e.toString()).toMatch(/Could not resolve package \(does not exist\) for app. Relative modules are relative to:/);
		}

		expect(threw).toBe(true);
	});


	test ('start() registers process message handler, ties SIGHUP to restart()', () => {
		stub(process, 'on');
		const worker = require('../worker');

		worker.start();


		expect(process.on).toHaveBeenCalledTimes(2);
		expect(process.on).toHaveBeenCalledWith('message', worker.messageHandler);
		expect(process.on).toHaveBeenCalledWith('SIGHUP', restart);

	});


	test ('init() sets up: express, service, and error handlers; starts a server listening', async () => {
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const proxy = jest.fn(() => ({createServer}));
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('findhit-proxywrap', () => ({proxy}));
		jest.doMock('http', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		const worker = require('../worker');

		const svr = await worker.init(config);

		expect(server).toEqual(svr);
		expect(proxy).not.toHaveBeenCalled();
		expect(express).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledWith(app, config, restart);
		expect(setupErrorHandler).toHaveBeenCalledTimes(1);

		expect(createServer).toHaveBeenCalledTimes(1);
		expect(createServer).toHaveBeenCalledWith(app);

		expect(listen).toHaveBeenCalledTimes(1);
		expect(listen).toHaveBeenCalledWith(port, '0.0.0.0', expect.any(Function));
		expect(listen.mock.calls[0][2]).toEqual(expect.any(Function));
		expect(listen.mock.calls[0][2]).not.toThrow();
	});


	test ('init() will use proxy-protocol if configured', async () => {
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const proxy = jest.fn(() => ({createServer}));
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {protocol: 'proxy', port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('findhit-proxywrap', () => ({proxy}));
		jest.doMock('http', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		const worker = require('../worker');

		const svr = await worker.init(config);

		expect(server).toEqual(svr);
		expect(proxy).toHaveBeenCalled();
		expect(express).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledWith(app, config, restart);
		expect(setupErrorHandler).toHaveBeenCalledTimes(1);

		expect(createServer).toHaveBeenCalledTimes(1);
		expect(createServer).toHaveBeenCalledWith(app);

		expect(listen).toHaveBeenCalledTimes(1);
		expect(listen).toHaveBeenCalledWith(port, '0.0.0.0', expect.any(Function));
	});


	test ('init() will use https if configured', async () => {
		const fs = require('fs');
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {protocol: 'https', port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('https', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		stub(fs, 'readFileSync', (f) => f);
		stub(fs, 'existsSync', () => true);

		process.env.NTI_BUILDOUT_PATH = '/some/path';

		const worker = require('../worker');

		const svr = await worker.init(config);

		expect(server).toEqual(svr);
		expect(express).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledTimes(1);
		expect(setupApplication).toHaveBeenCalledWith(app, config, restart);
		expect(setupErrorHandler).toHaveBeenCalledTimes(1);

		expect(createServer).toHaveBeenCalledTimes(1);
		expect(createServer).toHaveBeenCalledWith(
			expect.objectContaining({
				cert: expect.any(String),
				key: expect.any(String),
			}),
			app
		);

		expect(listen).toHaveBeenCalledTimes(1);
		expect(listen).toHaveBeenCalledWith(port, '0.0.0.0', expect.any(Function));
	});


	test ('init() with https with no NTI_BUILDOUT_PATH', async () => {
		const fs = require('fs');
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {protocol: 'https', port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('https', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		stub(fs, 'readFileSync', (f) => f);
		stub(fs, 'existsSync', (f) => false);
		stub(process, 'exit', fail);
		stub(console, 'error', () => {});


		process.env.HOME = '/junk';
		delete process.env.NTI_BUILDOUT_PATH;

		const worker = require('../worker');

		return expect(worker.init(config)).rejects.toThrow('Could not create secure server.');
	});


	test ('init() with https with bad NTI_BUILDOUT_PATH', async () => {
		const fs = require('fs');
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {protocol: 'https', port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('https', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		stub(console, 'error', () => {});
		stub(fs, 'existsSync', (f) => false);
		stub(process, 'exit', fail);

		process.env.HOME = '/junk';
		process.env.NTI_BUILDOUT_PATH = '/doesNotExist';

		const worker = require('../worker');

		return expect(worker.init(config)).rejects.toThrow('Could not create secure server.');
	});

	test ('init() with https with existing but bad NTI_BUILDOUT_PATH', async () => {
		const fs = require('fs');
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {protocol: 'https', port};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('https', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		stub(console, 'error', () => {});
		stub(fs, 'existsSync', fail);
		stub(process, 'exit', fail);

		process.env.HOME = '/junk';
		process.env.NTI_BUILDOUT_PATH = '/exists';

		const worker = require('../worker');

		await expect(worker.init(config)).rejects.toThrow('Could not create secure server.');
		expect(process.exit).not.toHaveBeenCalled();
	});


	test ('init() will use address if configured', async () => {
		const listen = jest.fn();
		const server = {listen};
		const createServer = jest.fn(() => server);
		const proxy = jest.fn();
		const app = {set () {}, engine () {}};
		const express = jest.fn(() => app);
		const port = 12345;
		const config = {port, address: 'abc'};

		const setupApplication = jest.fn();
		const setupErrorHandler = jest.fn();

		jest.doMock('findhit-proxywrap', () => ({proxy}));
		jest.doMock('http', () => ({createServer}));
		jest.doMock('express', () => express);

		jest.doMock('../lib/app-service', () => ({setupApplication}));
		jest.doMock('../lib/error-handler', () => ({setupErrorHandler}));

		const worker = require('../worker');

		const svr = await worker.init(config);

		expect(server).toEqual(svr);

		expect(listen).toHaveBeenCalledTimes(1);
		expect(listen).toHaveBeenCalledWith(port, config.address, expect.any(Function));
	});


	test ('message handler: handles "init"', async () => {
		const exitCode = process.exitCode;
		const disconnect = jest.fn();
		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init');

		await worker.messageHandler({topic: 'default', cmd: 'init'});

		expect(worker.init).toHaveBeenCalled();

		expect(exitCode).toEqual(process.exitCode);
		expect(disconnect).not.toHaveBeenCalled();
	});


	test ('message handler: handles "init" error', async () => {
		const disconnect = jest.fn();
		const exitCode = 1;
		const stubby = jest.fn();
		const send = process.send
			? (stub(process, 'send'), process.send)
			: (process.send = stubby);

		stub(process, 'exit');

		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init', () => {throw new Error('Test');});

		await worker.messageHandler({topic: 'default', cmd: 'init'});

		if (send === stubby) {
			delete process.send;
		}

		expect(send).toHaveBeenCalled();
		expect(worker.init).toHaveBeenCalled();

		expect(exitCode).toEqual(process.exitCode);
		expect(disconnect).toHaveBeenCalled();
	});


	test ('message handler: handles "close" before init', async () => {
		const disconnect = jest.fn();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		jest.spyOn(server, 'close');

		stub(process, 'exit');

		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init', () => server);

		await worker.messageHandler({topic: 'default', cmd: 'close'});

		expect(exitCode).toEqual(process.exitCode);

		expect(process.exit).toHaveBeenCalled();
		expect(worker.init).not.toHaveBeenCalled();
		expect(server.close).not.toHaveBeenCalled();
		expect(disconnect).toHaveBeenCalled();
	});


	test ('message handler: handles "close" after init', async () => {
		const disconnect = jest.fn();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		jest.spyOn(server, 'close');

		stub(process, 'exit');

		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init', () => server);

		await worker.messageHandler({topic: 'default', cmd: 'init'});
		await worker.messageHandler({topic: 'default', cmd: 'close'});


		expect(exitCode).toEqual(process.exitCode);

		expect(worker.init).toHaveBeenCalled();
		expect(server.close).toHaveBeenCalled();
		expect(disconnect).toHaveBeenCalled();
		expect(process.exit).toHaveBeenCalled();
	});


	test ('message handler: unknown messages do not crash.', async () => {
		const exitCode = process.exitCode;
		const disconnect = jest.fn();
		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init');

		await worker.messageHandler();
		await worker.messageHandler({});
		await worker.messageHandler({topic: 'default', cmd: 'this-does-not-exist'});


		expect(exitCode).toEqual(process.exitCode);

		expect(worker.init).not.toHaveBeenCalled();
		expect(disconnect.called).not.toBeTruthy();
	});

});
