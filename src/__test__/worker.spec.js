'use strict';
const assert = require('assert');

const mock = require('mock-require');
const sinon = require('sinon');


describe('Worker', () => {
	let logger, sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();

		logger = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};

		mock('../lib/logger', logger);
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('start() registers process message handler, ties SIGHUP to restart()', () => {
		sandbox.stub(process, 'on');
		const worker = mock.reRequire('../worker');

		worker.start();


		process.on.should.have.been.calledTwice;
		process.on.should.have.been.calledWith('message', worker.messageHandler);
		process.on.should.have.been.calledWith('SIGHUP', worker.restart);

	});


	it ('restart() sends WORKER_WANTS_TO_RESTART_THE_POOL', () => {
		const stubby = sandbox.stub();
		const send = process.send
			? (sandbox.stub(process, 'send'), process.send)
			: (process.send = stubby);

		const worker = mock.reRequire('../worker');

		worker.restart();

		if (send === stubby) {
			delete process.send;
		}

		send.should.have.been.calledOnce;
		send.should.have.been.calledWith({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
	});


	it ('init() sets up: express, service, and error handlers; starts a server listening', () => {
		const listen = sandbox.stub();
		const server = {listen};
		const createServer = sandbox.stub().returns(server);
		const proxy = sandbox.stub().returns({createServer});
		const app = {set () {}};
		const express = sandbox.stub().returns(app);
		const config = {};
		const port = 12345;

		const setupApplication = sandbox.stub().returns(port);
		const setupErrorHandler = sandbox.stub();

		mock('findhit-proxywrap', {proxy});
		mock('http', {createServer});
		mock('express', express);

		mock('../lib/app-service', {setupApplication});
		mock('../lib/error-handler', {setupErrorHandler});

		const worker = mock.reRequire('../worker');

		const svr = worker.init(config);

		server.should.be.equal(svr);
		proxy.should.not.have.been.called;
		express.should.have.been.calledOnce;
		setupApplication.should.have.been.calledOnce;
		setupApplication.should.have.been.calledWith(app, config, worker.restart);
		setupErrorHandler.should.have.been.calledOnce;

		createServer.should.have.been.calledOnce;
		createServer.should.have.been.calledWith(app);

		listen.should.have.been.calledOnce;
		listen.should.have.been.calledWith(port, '0.0.0.0');
		listen.getCall(0).args[2].should.be.a('function');
		assert.doesNotThrow(listen.getCall(0).args[2]);
	});


	it ('init() will use proxy-protocol if configured', () => {
		const listen = sandbox.stub();
		const server = {listen};
		const createServer = sandbox.stub().returns(server);
		const proxy = sandbox.stub().returns({createServer});
		const app = {set () {}};
		const express = sandbox.stub().returns(app);
		const config = {protocol: 'proxy'};
		const port = 12345;

		const setupApplication = sandbox.stub().returns(port);
		const setupErrorHandler = sandbox.stub();

		mock('findhit-proxywrap', {proxy});
		mock('http', {createServer});
		mock('express', express);

		mock('../lib/app-service', {setupApplication});
		mock('../lib/error-handler', {setupErrorHandler});

		const worker = mock.reRequire('../worker');

		const svr = worker.init(config);

		server.should.be.equal(svr);
		proxy.should.have.been.called;
		express.should.have.been.calledOnce;
		setupApplication.should.have.been.calledOnce;
		setupApplication.should.have.been.calledWith(app, config, worker.restart);
		setupErrorHandler.should.have.been.calledOnce;

		createServer.should.have.been.calledOnce;
		createServer.should.have.been.calledWith(app);

		listen.should.have.been.calledOnce;
		listen.should.have.been.calledWith(port, '0.0.0.0');
	});


	it ('init() will use address if configured', () => {
		const listen = sandbox.stub();
		const server = {listen};
		const createServer = sandbox.stub().returns(server);
		const proxy = sandbox.stub();
		const app = {set () {}};
		const express = sandbox.stub().returns(app);
		const config = {address: 'abc'};
		const port = 12345;

		const setupApplication = sandbox.stub().returns(port);
		const setupErrorHandler = sandbox.stub();

		mock('findhit-proxywrap', {proxy});
		mock('http', {createServer});
		mock('express', express);

		mock('../lib/app-service', {setupApplication});
		mock('../lib/error-handler', {setupErrorHandler});

		const worker = mock.reRequire('../worker');

		const svr = worker.init(config);

		server.should.be.equal(svr);

		listen.should.have.been.calledOnce;
		listen.should.have.been.calledWith(port, config.address);
	});


	it ('message handler: handles "init"', () => {
		const exitCode = process.exitCode;
		const disconnect = sandbox.stub();
		mock('cluster', {worker: {disconnect}});

		const worker = mock.reRequire('../worker');

		sandbox.stub(worker, 'init');

		assert.doesNotThrow(() => {
			worker.messageHandler({cmd: 'init'});
		});

		worker.init.should.have.been.called;

		assert(exitCode === process.exitCode);
		disconnect.should.not.have.been.called;
	});


	it ('message handler: handles "init" error', () => {
		const disconnect = sandbox.stub();
		const exitCode = 1;
		const stubby = sandbox.stub();
		const send = process.send
			? (sandbox.stub(process, 'send'), process.send)
			: (process.send = stubby);

		sandbox.stub(process, 'exit');

		mock('cluster', {worker: {disconnect}});

		const worker = mock.reRequire('../worker');

		sandbox.stub(worker, 'init').throws(new Error('Test'));

		assert.doesNotThrow(() => {
			worker.messageHandler({cmd: 'init'});
		});

		if (send === stubby) {
			delete process.send;
		}

		send.should.have.been.called;
		worker.init.should.have.been.called;

		exitCode.should.be.equal(process.exitCode);
		disconnect.should.have.been.called;
	});


	it ('message handler: handles "close" before init', () => {
		const disconnect = sandbox.stub();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		sandbox.spy(server, 'close');

		sandbox.stub(process, 'exit');

		mock('cluster', {worker: {disconnect}});

		const worker = mock.reRequire('../worker');

		sandbox.stub(worker, 'init').returns(server);

		assert.doesNotThrow(() => {
			worker.messageHandler({cmd: 'close'});
		});

		assert(exitCode === process.exitCode);

		process.exit.should.have.been.called;
		worker.init.should.not.have.been.called;
		server.close.should.not.have.been.called;
		disconnect.should.have.been.called;
	});


	it ('message handler: handles "close" after init', () => {
		const disconnect = sandbox.stub();
		const exitCode = process.exitCode;

		const server = {close (fn) {fn();}};
		sandbox.spy(server, 'close');

		sandbox.stub(process, 'exit');

		mock('cluster', {worker: {disconnect}});

		const worker = mock.reRequire('../worker');

		sandbox.stub(worker, 'init').returns(server);

		assert.doesNotThrow(() => {
			worker.messageHandler({cmd: 'init'});
			worker.messageHandler({cmd: 'close'});
		});

		assert(exitCode === process.exitCode);

		process.exit.should.not.have.been.called;
		worker.init.should.have.been.called;
		server.close.should.have.been.called;
		disconnect.should.have.been.called;
	});


	it ('message handler: unknown messages do not crash.', () => {
		const exitCode = process.exitCode;
		const disconnect = sandbox.stub();
		mock('cluster', {worker: {disconnect}});

		const worker = mock.reRequire('../worker');

		sandbox.stub(worker, 'init');

		assert.doesNotThrow(() => {
			worker.messageHandler();
			worker.messageHandler({});
			worker.messageHandler({cmd: 'this-does-not-exist'});
		});


		assert(exitCode === process.exitCode);

		worker.init.should.not.have.been.called;
		disconnect.called.should.not.be.true;


	});

});
