/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('Master', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		jest.dontMock('cluster');
		logger = require('../lib/logger');
		stub(logger, 'get', () => logger);
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

	test('start() adds listeners and calls load()', () => {
		stub(process, 'on');
		const cluster = {
			on: jest.fn(),
		};
		jest.doMock('cluster', () => cluster);
		const master = require('../master');

		stub(master, 'load');

		master.start();

		expect(master.load).toHaveBeenCalledTimes(1);

		expect(process.on).toHaveBeenCalled();
		expect(process.on).toHaveBeenCalledWith('SIGHUP', master.load);

		expect(cluster.on).toHaveBeenCalledWith(
			'message',
			master.handleMessage
		);
		expect(cluster.on).toHaveBeenCalledWith('exit', master.onWorkerExit);
	});

	test('load() calls loadConfig() and init(config)', () => {
		const p = Promise.resolve({});
		const config = {
			loadConfig: jest.fn(() => p),
		};
		jest.doMock('../lib/config', () => config);
		const master = require('../master');
		stub(master, 'init');

		return master.load().then(() => {
			expect(config.loadConfig).toHaveBeenCalledTimes(1);
			expect(master.init).toHaveBeenCalledTimes(1);
		});
	});

	test('if fails loadConfig() does not call init()', () => {
		const config = {
			loadConfig: jest.fn(() => Promise.reject()),
		};
		jest.doMock('../lib/config', () => config);
		const master = require('../master');
		stub(master, 'init');

		return master.load().then(() => {
			expect(config.loadConfig).toHaveBeenCalledTimes(1);
			expect(master.init).not.toHaveBeenCalled();
		});
	});

	test('init() prints config flags, and applys config with setConfig()', () => {
		const config = {
			showFlags: jest.fn(),
		};
		const utils = {
			setConfig: jest.fn(),
			getActiveWorkers: () => [],
		};

		const mockConfig = {};

		jest.doMock('../lib/config', () => config);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'maintainWorkerCount');
		stub(master, 'restartWorkers');

		master.init(mockConfig);

		expect(config.showFlags).toHaveBeenCalled();
		expect(utils.setConfig).toHaveBeenCalledWith(mockConfig);
	});

	test('init() adds our version to the config', () => {
		const config = { showFlags() {} };
		const utils = {
			setConfig() {},
			getActiveWorkers: () => [],
		};

		const mockConfig = { versions: {} };

		jest.doMock('../lib/config', () => config);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'maintainWorkerCount');
		stub(master, 'restartWorkers');

		expect(mockConfig).not.toHaveProperty('versions.service');

		master.init(mockConfig);

		expect(mockConfig).toHaveProperty('versions.service');
	});

	test('init() if the config does not have "versions" defined, it adds it', () => {
		const config = { showFlags() {} };
		const utils = {
			setConfig() {},
			getActiveWorkers: () => [],
		};

		const mockConfig = {};

		jest.doMock('../lib/config', () => config);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'maintainWorkerCount');
		stub(master, 'restartWorkers');

		expect(mockConfig).not.toHaveProperty('versions');

		master.init(mockConfig);

		expect(mockConfig).toHaveProperty('versions.service');
	});

	test('init() starts workers, if non are running', () => {
		const config = { showFlags() {} };
		const utils = {
			setConfig() {},
			getActiveWorkers: () => [],
		};

		const mockConfig = {};

		jest.doMock('../lib/config', () => config);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'maintainWorkerCount');
		stub(master, 'restartWorkers');

		master.init(mockConfig);

		expect(master.maintainWorkerCount).toHaveBeenCalledTimes(1);
		expect(master.restartWorkers).not.toHaveBeenCalled();
	});

	test('init() restarts workers, if some are running', () => {
		const config = { showFlags() {} };
		const utils = {
			setConfig() {},
			getActiveWorkers: () => [{}, {}],
		};

		const mockConfig = {};

		jest.doMock('../lib/config', () => config);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'maintainWorkerCount');
		stub(master, 'restartWorkers');

		master.init(mockConfig);

		expect(master.maintainWorkerCount).not.toHaveBeenCalled();
		expect(master.restartWorkers).toHaveBeenCalledTimes(1);
	});

	test('startWorker() forks a new process and sends it the config', () => {
		const cfg = {};
		const utils = {
			getConfig: jest.fn(() => cfg),
			getConfiguredWorkerCount: jest.fn(() => 12),
		};
		const w = {
			send: jest.fn(),
		};
		const cluster = {
			fork: jest.fn(() => w),
			listeners: jest.fn(() => []),
			on: jest.fn(() => {}),
		};

		jest.doMock('cluster', () => cluster);
		jest.doMock('../lib/master-utils', () => utils);
		jest.useFakeTimers();

		const master = require('../master');

		const res = master.startWorker();
		jest.runAllTimers();

		expect(cluster.fork).toHaveBeenCalledTimes(1);
		expect(w.send).toHaveBeenCalledTimes(1);
		expect(w.send).toHaveBeenCalledWith({
			cmd: 'init',
			config: cfg,
			topic: 'default',
		});

		expect(res).toBe(w);
		jest.useRealTimers();
	});

	test('maintainWorkerCount() starts workers and stops', () => {
		let continueEventCallback;

		const newWorker = {};
		const port = 1234;
		const address = { port };
		const active = [{}, {}];
		const cluster = {
			on: (evt, cb) => {
				if (evt === 'listening') {
					continueEventCallback = cb;
				}
			},
			listeners() {}, //just getby, we'll test that next
			removeListener: jest.fn(),
		};
		jest.spyOn(cluster, 'on');

		const utils = {
			getConfig: () => ({ port }),
			getConfiguredWorkerCount: () => 3,
			getActiveWorkers: () => active,
		};

		jest.doMock('cluster', () => cluster);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		jest.spyOn(master, 'startWorker').mockImplementation(() => newWorker);

		//kick off
		master.maintainWorkerCount();

		expect(cluster.on).toHaveBeenCalled;
		expect(cluster.on).toHaveBeenCalledWith(
			'listening',
			continueEventCallback
		);
		expect(continueEventCallback).toEqual(expect.any(Function));

		expect(cluster.removeListener).not.toHaveBeenCalled();

		expect(master.startWorker).toHaveBeenCalled();
		active.push(newWorker);

		continueEventCallback(newWorker, address);

		expect(cluster.removeListener).toHaveBeenCalled();
		expect(cluster.removeListener).toHaveBeenCalledWith(
			'listening',
			continueEventCallback
		);
	});

	test('maintainWorkerCount() may do nothing', () => {
		let continueEventCallback;

		const newWorker = {};
		const port = 1234;
		const active = [{}];
		const cluster = {
			on: (evt, cb) => {
				if (evt === 'listening') {
					continueEventCallback = cb;
				}
			},
			listeners() {}, //just getby, we'll test that next
			removeListener: jest.fn(),
		};
		jest.spyOn(cluster, 'on');

		const utils = {
			getConfig: () => ({ port }),
			getConfiguredWorkerCount: () => 1,
			getActiveWorkers: () => active,
		};

		jest.doMock('cluster', () => cluster);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		jest.spyOn(master, 'startWorker').mockImplementation(() => newWorker);

		//kick off
		master.maintainWorkerCount();

		expect(cluster.on).toHaveBeenCalled;
		expect(cluster.on).toHaveBeenCalledWith(
			'listening',
			continueEventCallback
		);
		expect(continueEventCallback).toEqual(expect.any(Function));

		expect(cluster.removeListener).toHaveBeenCalled;
		expect(cluster.removeListener).toHaveBeenCalledWith(
			'listening',
			continueEventCallback
		);

		expect(master.startWorker).not.toHaveBeenCalled;
	});

	test('maintainWorkerCount() interrupts previous invocation by removing the old listeners', () => {
		const port = 1234;
		const active = [{}];

		const listening = Array.from({ length: 2 }).map(() => ({
			name: 'startAnother',
		}));

		const cluster = {
			listeners: () => listening,
			on: jest.fn(),
			removeListener: jest.fn(),
		};

		const utils = {
			getConfig: () => ({ port }),
			getConfiguredWorkerCount: () => 1,
			getActiveWorkers: () => active,
		};

		jest.doMock('cluster', () => cluster);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		stub(master, 'startWorker');

		//kick off
		master.maintainWorkerCount();

		expect(cluster.removeListener).toHaveBeenCalledTimes(
			listening.length + 1
		); //the plus 1 is the finish
	});

	test('maintainWorkerCount() :: startAnother ignores other workers and ports', () => {
		let continueEventCallback;

		const newWorker = {};
		const port = 1234;
		const active = [{}];
		const cluster = {
			on: (evt, cb) => {
				if (evt === 'listening') {
					continueEventCallback = cb;
				}
			},
			listeners() {}, //just getby, we'll test that next
			removeListener: jest.fn(),
		};
		jest.spyOn(cluster, 'on');

		const utils = {
			getConfig: () => ({ port }),
			getConfiguredWorkerCount: () => 2,
			getActiveWorkers: () => active,
		};
		jest.spyOn(utils, 'getConfiguredWorkerCount');
		jest.spyOn(utils, 'getActiveWorkers');

		jest.doMock('cluster', () => cluster);
		jest.doMock('../lib/master-utils', () => utils);

		const master = require('../master');

		jest.spyOn(master, 'startWorker').mockImplementation(() => newWorker);

		//kick off
		master.maintainWorkerCount();

		active.push(newWorker);

		expect(cluster.on).toHaveBeenCalled();
		expect(cluster.on).toHaveBeenCalledWith(
			'listening',
			continueEventCallback
		);
		expect(continueEventCallback).toEqual(expect.any(Function));

		utils.getConfiguredWorkerCount.mockClear();
		utils.getActiveWorkers.mockClear();

		continueEventCallback();
		expect(utils.getConfiguredWorkerCount).not.toHaveBeenCalled();
		expect(utils.getActiveWorkers).not.toHaveBeenCalled();

		continueEventCallback({}, { port });
		expect(utils.getConfiguredWorkerCount).not.toHaveBeenCalled();
		expect(utils.getActiveWorkers).not.toHaveBeenCalled();

		continueEventCallback(newWorker, { port: 21312 });
		expect(utils.getConfiguredWorkerCount).not.toHaveBeenCalled();
		expect(utils.getActiveWorkers).not.toHaveBeenCalled();

		expect(cluster.removeListener).not.toHaveBeenCalled();

		continueEventCallback(newWorker, { port });
		expect(utils.getConfiguredWorkerCount).toHaveBeenCalled();
		expect(utils.getActiveWorkers).toHaveBeenCalled();

		expect(cluster.removeListener).toHaveBeenCalled();
	});

	test('Handles "unknown" message', () => {
		const master = require('../master');
		master.handleMessage({ id: 'mock' }, { topic: 'default' });

		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	test('Handles "NOTIFY_DEVMODE" message', () => {
		const utils = {
			setConfiguredWorkerCount: jest.fn(() => 1),
		};
		jest.doMock('../lib/master-utils', () => utils);
		const master = require('../master');
		master.handleMessage(
			{ id: 'mock' },
			{ topic: 'default', cmd: 'NOTIFY_DEVMODE' }
		);

		expect(utils.setConfiguredWorkerCount).toHaveBeenCalledTimes(1);
		expect(utils.setConfiguredWorkerCount).toHaveBeenCalledWith(1);
		expect(logger.error).not.toHaveBeenCalled();
	});

	test('Handles unknown "WORKER_WANTS_TO_RESTART_THE_POOL"', () => {
		const master = require('../master');
		stub(master, 'restartWorkers');
		master.handleMessage(
			{ id: 'mock' },
			{ topic: 'default', cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL' }
		);

		expect(master.restartWorkers).toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});

	test('Handles unknown "FATAL_ERROR"', () => {
		const master = require('../master');
		master.handleMessage(
			{ id: 'mock' },
			{ topic: 'default', cmd: 'FATAL_ERROR' }
		);

		expect(logger.error).toHaveBeenCalled();
	});

	test('onWorkerExit() logs, and queues up new workers', () => {
		const master = require('../master');
		stub(master, 'maintainWorkerCount');

		master.onWorkerExit({ process: { pid: 'mock' } }, 1, 'ERROR'); //error code, maintainWorkerCount should be called.
		expect(logger.info).toHaveBeenCalled();
		expect(master.maintainWorkerCount).toHaveBeenCalled();

		logger.info.mockClear();
		master.maintainWorkerCount.mockClear();

		master.onWorkerExit({ process: { pid: 'mock' } }, 1); //error code, maintainWorkerCount should be called.
		expect(logger.info).toHaveBeenCalled();
		expect(master.maintainWorkerCount).toHaveBeenCalled();

		logger.info.mockClear();
		master.maintainWorkerCount.mockClear();

		master.onWorkerExit({ process: { pid: 'mock' } }, 0); //no error code (clean exit), maintainWorkerCount should be called.
		expect(logger.info).toHaveBeenCalled();
		expect(master.maintainWorkerCount).toHaveBeenCalled();
	});

	test('restartWorkers() should send all curent workers the close message, but only one at a time', () => {
		const once = jest.fn();
		const fakeWorkers = Array.from({ length: 2 }).map(() => ({
			isConnected: () => true,
			send: jest.fn(),
		}));
		const utils = {
			getConfiguredWorkerCount: jest.fn(() => 1),
			getActiveWorkers: jest.fn(() => fakeWorkers.slice()),
		};

		jest.doMock('cluster', () => ({ once }));
		jest.doMock('../lib/master-utils', () => utils);
		const master = require('../master');

		master.restartWorkers();
		master.restartWorkers();

		const verify = x => {
			expect(x).toHaveBeenCalledTimes(1);
			expect(x).toHaveBeenCalledWith({ topic: 'default', cmd: 'close' });
		};

		verify(fakeWorkers[0].send);
		expect(fakeWorkers[1].send).not.toHaveBeenCalled();
		expect(utils.getActiveWorkers).toHaveBeenCalled();
		expect(utils.getConfiguredWorkerCount).toHaveBeenCalled();

		expect(once).toHaveBeenCalledTimes(1);
		expect(once).toHaveBeenCalledWith('exit', expect.any(Function));

		const [, continueEventCallback] = once.mock.calls[0];
		continueEventCallback();

		continueEventCallback(); //should noop (we only have two items)

		fakeWorkers.map(x => verify(x.send));

		expect(once).toHaveBeenCalledTimes(2);
		expect(once).toHaveBeenCalledWith('listening', expect.any(Function));
	});
});
