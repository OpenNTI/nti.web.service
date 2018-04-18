/*eslint-env jest*/
'use strict';

describe('lib/logger (middleware)', () => {
	let loggerBackend,
		morganConstructor,
		responseTimeConstructor,
		LoggerFactory;


	beforeEach(() => {
		jest.resetModules();

		loggerBackend = {
			debug: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
		};

		responseTimeConstructor = jest.fn(() => 'response-time-middleware');
		morganConstructor = function () { return 'morgan-middleware'; };

		LoggerFactory = {get: jest.fn(() => loggerBackend)};

		jest.doMock('cluster', () => ({isMaster: true}));
		jest.doMock('morgan', () => morganConstructor);
		jest.doMock('response-time', () => responseTimeConstructor);
		jest.doMock('@nti/util-logger', () => ({default: LoggerFactory}));
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('Should export a usable interface', () => {
		const logger = require('../logger');
		expect(logger).toHaveProperty('get', expect.any(Function));
		expect(logger).toHaveProperty('attachToExpress', expect.any(Function));
		expect(logger).toHaveProperty('info', expect.any(Function));
		expect(logger).toHaveProperty('error', expect.any(Function));
		expect(logger).toHaveProperty('warn', expect.any(Function));
		expect(logger).toHaveProperty('debug', expect.any(Function));
	});


	test ('Should use an @nti/util-logger backend and identify master', () => {
		require('../logger');
		expect(LoggerFactory.get).toHaveBeenCalled();
		expect(LoggerFactory.get).toHaveBeenCalledWith('NodeService:master');
	});


	test ('Should use an @nti/util-logger backend and identify worker', () => {
		jest.doMock('cluster', () => ({isMaster: false, worker: {id: 'foobar'}}));
		require('../logger');

		expect(LoggerFactory.get).toHaveBeenCalledWith('NodeService:worker:foobar');
	});


	test ('get(name) returns a new logger with its name prefixed with NodeService', () => {
		const {get} = require('../logger');

		const logger = get('SomeTest');
		expect(LoggerFactory.get).toHaveBeenCalledWith('NodeService:master:SomeTest');
		expect(logger).toHaveProperty('info', expect.any(Function));
		expect(logger).toHaveProperty('error', expect.any(Function));
		expect(logger).toHaveProperty('warn', expect.any(Function));
		expect(logger).toHaveProperty('debug', expect.any(Function));
	});


	test ('attachToExpress() sets up ', () => {
		const {attachToExpress} = require('../logger');
		const use = jest.fn();

		expect(() => attachToExpress({use})).not.toThrow();
		expect(attachToExpress({use: jest.fn()})).not.toBeDefined();

		expect(use).toHaveBeenCalledTimes(2);
		expect(use).toHaveBeenCalledWith('response-time-middleware');
		expect(use).toHaveBeenCalledWith('morgan-middleware');
	});


	test ('The static logger methods should forward arguments to the backend', () => {
		const logger = require('../logger');
		const methods = ['info', 'error', 'warn', 'debug'];

		for (let method of methods) {
			const args = ['Test', 'abc'];

			logger[method](...args);

			expect(loggerBackend[method]).toHaveBeenCalledWith(...args);
			// expect(loggerBackend[method]).calledOn(loggerBackend);
		}
	});
});
