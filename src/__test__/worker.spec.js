/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('Worker', () => {
	let logger, restart;

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
		// jest.restoreAllMocks();
		jest.resetModules();
		jest.dontMock('cluster');
	});



	test ('getApp() No Configuration', () => {
		const {getApp} = require('../worker');

		expect(() => getApp({})).toThrow('No configuration');
	});


	test ('getApp() Missing app package', () => {
		const {getApp} = require('../worker');

		expect(() => getApp({
			server: 'foo',
			apps: [{
				package: 'does not exist',
				basepath: '/test/'
			}],
		})).toThrow(/Could not resolve package \(does not exist\) for app. Relative modules are relative to:/);
	});


	test ('start() registers process message handler, ties SIGHUP to restart()', () => {
		stub(process, 'on');
		const worker = require('../worker');

		worker.start();


		expect(process.on).toHaveBeenCalledTimes(2);
		expect(process.on).toHaveBeenCalledWith('message', worker.messageHandler);
		expect(process.on).toHaveBeenCalledWith('SIGHUP', restart);

	});


	test ('init() sets up: express, service, and error handlers; starts a server listening', () => {
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

		const svr = worker.init(config);

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


	test ('init() will use proxy-protocol if configured', () => {
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

		const svr = worker.init(config);

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


	test ('init() will use address if configured', () => {
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

		const svr = worker.init(config);

		expect(server).toEqual(svr);

		expect(listen).toHaveBeenCalledTimes(1);
		expect(listen).toHaveBeenCalledWith(port, config.address, expect.any(Function));
	});


	test ('message handler: handles "init"', () => {
		const exitCode = process.exitCode;
		const disconnect = jest.fn();
		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init');

		expect(() => {
			worker.messageHandler({cmd: 'init'});
		}).not.toThrow();

		expect(worker.init).toHaveBeenCalled();

		expect(exitCode).toEqual(process.exitCode);
		expect(disconnect).not.toHaveBeenCalled();
	});


	test ('message handler: handles "init" error', () => {
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

		expect(() => {
			worker.messageHandler({cmd: 'init'});
		}).not.toThrow();

		if (send === stubby) {
			delete process.send;
		}

		expect(send).toHaveBeenCalled();
		expect(worker.init).toHaveBeenCalled();

		expect(exitCode).toEqual(process.exitCode);
		expect(disconnect).toHaveBeenCalled();
	});


	test ('message handler: handles "close" before init', () => {
		const disconnect = jest.fn();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		jest.spyOn(server, 'close');

		stub(process, 'exit');

		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init', () => server);

		expect(() => {
			worker.messageHandler({cmd: 'close'});
		}).not.toThrow();

		expect(exitCode).toEqual(process.exitCode);

		expect(process.exit).toHaveBeenCalled();
		expect(worker.init).not.toHaveBeenCalled();
		expect(server.close).not.toHaveBeenCalled();
		expect(disconnect).toHaveBeenCalled();
	});


	test ('message handler: handles "close" after init', () => {
		const disconnect = jest.fn();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		jest.spyOn(server, 'close');

		stub(process, 'exit');

		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init', () => server);

		expect(() => {
			worker.messageHandler({cmd: 'init'});
			worker.messageHandler({cmd: 'close'});
		}).not.toThrow();

		expect(exitCode).toEqual(process.exitCode);

		expect(worker.init).toHaveBeenCalled();
		expect(server.close).toHaveBeenCalled();
		expect(disconnect).toHaveBeenCalled();
		expect(process.exit).toHaveBeenCalled();
	});


	test ('message handler: unknown messages do not crash.', () => {
		const exitCode = process.exitCode;
		const disconnect = jest.fn();
		jest.doMock('cluster', () => ({worker: {disconnect}}));

		const worker = require('../worker');

		stub(worker, 'init');

		expect(() => {
			worker.messageHandler();
			worker.messageHandler({});
			worker.messageHandler({cmd: 'this-does-not-exist'});
		}).not.toThrow();


		expect(exitCode).toEqual(process.exitCode);

		expect(worker.init).not.toHaveBeenCalled();
		expect(disconnect.called).not.toBeTruthy();
	});

});
