/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/logger (middleware)', () => {
	let loggerBackend,
		sandbox,
		morganConstructor,
		responseTimeConstructor,
		LoggerFactory;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		loggerBackend = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};
		responseTimeConstructor = sandbox.stub().returns('response-time-middleware');
		morganConstructor = function () { return 'morgan-middleware'; };

		LoggerFactory = {get: sandbox.stub().returns(loggerBackend)};

		mock('cluster', {isMaster: true});
		mock('morgan', morganConstructor);
		mock('response-time', responseTimeConstructor);
		mock('nti-util-logger', {default: LoggerFactory});
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('Should export a usable interface', () => {
		const logger = mock.reRequire('../logger');
		logger.should.itself.respondTo('get')
			.and.respondTo('attachToExpress')
			.and.respondTo('info')
			.and.respondTo('error')
			.and.respondTo('warn')
			.and.respondTo('debug');
	});


	it ('Should use an nti-util-logger backend and identify master/worker', () => {
		mock.reRequire('../logger');
		LoggerFactory.get.should.have.been.called;
		LoggerFactory.get.should.have.been.calledWith('NodeService:master');

		LoggerFactory.get.reset();

		mock('cluster', {isMaster: false, worker: {id: 'foobar'}});
		mock.reRequire('../logger');

		LoggerFactory.get.should.have.been.calledWith('NodeService:worker:foobar');
	});


	it ('get(name) returns a new logger with its name prefixed with NodeService', () => {
		const {get} = mock.reRequire('../logger');

		const logger = get('SomeTest');
		LoggerFactory.get.should.have.been.calledWithExactly('NodeService:master:SomeTest');
		logger.should.be.ok
			.and.respondTo('info')
			.and.respondTo('error')
			.and.respondTo('warn')
			.and.respondTo('debug');
	});


	it ('attachToExpress() sets up ', () => {
		const {attachToExpress} = mock.reRequire('../logger');
		const use = sandbox.stub();

		expect(() => attachToExpress({use}))
			.not.to.throw()
			.and.to.be.undefined;

		use.should.have.been.calledTwice
			.and.have.been.calledWith('response-time-middleware')
			.and.have.been.calledWith('morgan-middleware');
	});


	it ('The static logger methods should forward arguments to the backend', () => {
		const logger = mock.reRequire('../logger');
		const methods = ['info', 'error', 'warn', 'debug'];

		for (let method of methods) {
			const args = ['Test', 'abc'];

			logger[method](...args);

			loggerBackend[method].should.have.been.calledWithExactly(...args)
				.and.calledOn(loggerBackend);
		}
	});
});
