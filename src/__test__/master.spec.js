/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('Master', () => {
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


	it ('start() adds listeners and calls load()', () => {
		sandbox.spy(process, 'on');
		const cluster = {
			on: sandbox.stub()
		};
		mock('cluster', cluster);
		const master = mock.reRequire('../master');

		sandbox.stub(master, 'load');

		master.start();

		master.load.should.have.been.calledOnce;

		process.on.should.have.been.called;
		process.on.should.have.been.calledWith('SIGHUP', master.load);

		cluster.on.should.have.been.calledWith('message', master.handleMessage);
		cluster.on.should.have.been.calledWith('exit', master.onWorkerExit);
	});


	it ('load() calls loadConfig() and init(config)', (done) => {
		const p = Promise.resolve({});
		const config = {
			loadConfig: sandbox.stub().returns(p)
		};
		mock('../lib/config', config);
		const master = mock.reRequire('../master');
		sandbox.stub(master, 'init');

		master.load()
			.then(() => {
				config.loadConfig.should.have.been.calledOnce;
				master.init.should.have.been.calledOnce;
				done();
			})
			.catch(done);
	});


	it ('if fails loadConfig() does not call init()', (done) => {

		const config = {
			loadConfig: sandbox.stub().returns(Promise.reject())
		};
		mock('../lib/config', config);
		const master = mock.reRequire('../master');
		sandbox.stub(master, 'init');

		master.load()
			.then(() => {
				config.loadConfig.should.have.been.calledOnce;
				master.init.should.not.have.been.called;
				done();
			})
			.catch(done);
	});


	it ('init() prints config flags, and applys config with setConfig()', () => {
		const config = {
			showFlags: sandbox.stub()
		};
		const utils = {
			setConfig: sandbox.stub(),
			getActiveWorkers: () => []
		};

		const mockConfig = {};

		mock('../lib/config', config);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'maintainWorkerCount');
		sandbox.stub(master, 'restartWorkers');

		master.init(mockConfig);

		config.showFlags.should.have.been.called;
		utils.setConfig.should.have.been.calledWithExactly(mockConfig);
	});


	it ('init() adds our version to the config', () => {
		const config = { showFlags () {} };
		const utils = {
			setConfig () {},
			getActiveWorkers: () => []
		};

		const mockConfig = {versions: {}};

		mock('../lib/config', config);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'maintainWorkerCount');
		sandbox.stub(master, 'restartWorkers');

		mockConfig.versions.should.not.have.property('service');

		master.init(mockConfig);

		mockConfig.versions.should.have.property('service');
	});


	it ('init() if the config does not have "versions" defined, it adds it', () => {
		const config = { showFlags () {} };
		const utils = {
			setConfig () {},
			getActiveWorkers: () => []
		};

		const mockConfig = {};

		mock('../lib/config', config);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'maintainWorkerCount');
		sandbox.stub(master, 'restartWorkers');

		mockConfig.should.not.have.property('versions');

		master.init(mockConfig);

		mockConfig.versions.should.have.property('service');
	});


	it ('init() starts workers, if non are running', () => {
		const config = { showFlags () {} };
		const utils = {
			setConfig () {},
			getActiveWorkers: () => []
		};

		const mockConfig = {};

		mock('../lib/config', config);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'maintainWorkerCount');
		sandbox.stub(master, 'restartWorkers');

		master.init(mockConfig);

		master.maintainWorkerCount.should.have.been.calledOnce;
		master.restartWorkers.should.not.have.been.called;
	});


	it ('init() restarts workers, if some are running', () => {
		const config = { showFlags () {} };
		const utils = {
			setConfig () {},
			getActiveWorkers: () => [{},{}]
		};

		const mockConfig = {};

		mock('../lib/config', config);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'maintainWorkerCount');
		sandbox.stub(master, 'restartWorkers');

		master.init(mockConfig);

		master.maintainWorkerCount.should.not.have.been.called;
		master.restartWorkers.should.have.been.calledOnce;
	});


	it ('startWorker() forks a new process and sends it the config', () => {
		const cfg = {};
		const utils = {
			getConfig: sandbox.stub().returns(cfg)
		};
		const w = {
			send: sandbox.stub()
		};
		const cluster = {
			fork: sandbox.stub().returns(w)
		};

		mock('cluster', cluster);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		const res = master.startWorker();

		cluster.fork.should.have.been.calledOnce;
		w.send.should.have.been.calledOnce;
		w.send.should.have.been.calledWith({cmd: 'init', config: cfg});

		res.should.be.equal(w);

	});


	it ('maintainWorkerCount() starts workers and stops', () => {
		let continueEventCallback;

		const newWorker = {};
		const port = 1234;
		const address = {port};
		const active = [{},{}];
		const cluster = {
			on: (evt, cb) => {
				if (evt === 'listening') {
					continueEventCallback = cb;
				}
			},
			listeners () {}, //just getby, we'll test that next
			removeListener: sandbox.stub()
		};
		sandbox.spy(cluster, 'on');

		const utils = {
			getConfig: () => ({port}),
			getConfiguredWorkerCount: () => 3,
			getActiveWorkers: () => active,
		};

		mock('cluster', cluster);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'startWorker').returns(newWorker);

		//kick off
		master.maintainWorkerCount();

		cluster.on.should.have.been.called;
		cluster.on.should.have.been.calledWith('listening', continueEventCallback);
		continueEventCallback.should.be.a('function');

		cluster.removeListener.should.not.have.been.called;

		master.startWorker.should.have.been.called;
		active.push(newWorker);

		continueEventCallback(newWorker, address);

		cluster.removeListener.should.have.been.called;
		cluster.removeListener.should.have.been.calledWith('listening', continueEventCallback);
	});


	it ('maintainWorkerCount() may do nothing', () => {
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
			listeners () {}, //just getby, we'll test that next
			removeListener: sandbox.stub()
		};
		sandbox.spy(cluster, 'on');

		const utils = {
			getConfig: () => ({port}),
			getConfiguredWorkerCount: () => 1,
			getActiveWorkers: () => active,
		};

		mock('cluster', cluster);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'startWorker').returns(newWorker);

		//kick off
		master.maintainWorkerCount();

		cluster.on.should.have.been.called;
		cluster.on.should.have.been.calledWith('listening', continueEventCallback);
		continueEventCallback.should.be.a('function');

		cluster.removeListener.should.have.been.called;
		cluster.removeListener.should.have.been.calledWith('listening', continueEventCallback);

		master.startWorker.should.not.have.been.called;
	});


	it ('maintainWorkerCount() interrupts previous invocation by removing the old listeners', () => {
		const port = 1234;
		const active = [{}];

		const listening = Array.from({length: 2}).map(() => ({
			name: 'startAnother'
		}));

		const cluster = {
			listeners: () => listening,
			on: sandbox.stub(),
			removeListener: sandbox.stub()
		};

		const utils = {
			getConfig: () => ({port}),
			getConfiguredWorkerCount: () => 1,
			getActiveWorkers: () => active,
		};

		mock('cluster', cluster);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'startWorker').returns();

		//kick off
		master.maintainWorkerCount();

		cluster.removeListener.callCount.should.be.equal(listening.length + 1); //the plus 1 is the finish
	});


	it ('maintainWorkerCount() :: startAnother ignores other workers and ports', () => {
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
			listeners () {}, //just getby, we'll test that next
			removeListener: sandbox.stub()
		};
		sandbox.spy(cluster, 'on');

		const utils = {
			getConfig: () => ({port}),
			getConfiguredWorkerCount: () => 2,
			getActiveWorkers: () => active,
		};
		sandbox.spy(utils, 'getConfiguredWorkerCount');
		sandbox.spy(utils, 'getActiveWorkers');

		mock('cluster', cluster);
		mock('../lib/master-utils', utils);

		const master = mock.reRequire('../master');

		sandbox.stub(master, 'startWorker').returns(newWorker);

		//kick off
		master.maintainWorkerCount();

		active.push(newWorker);

		cluster.on.should.have.been.called;
		cluster.on.should.have.been.calledWith('listening', continueEventCallback);
		continueEventCallback.should.be.a('function');

		utils.getConfiguredWorkerCount.reset();
		utils.getActiveWorkers.reset();

		continueEventCallback();
		utils.getConfiguredWorkerCount.should.not.have.been.called;
		utils.getActiveWorkers.should.not.have.been.called;

		continueEventCallback({}, {port});
		utils.getConfiguredWorkerCount.should.not.have.been.called;
		utils.getActiveWorkers.should.not.have.been.called;

		continueEventCallback(newWorker, {port: 21312});
		utils.getConfiguredWorkerCount.should.not.have.been.called;
		utils.getActiveWorkers.should.not.have.been.called;

		cluster.removeListener.should.not.have.been.called;

		continueEventCallback(newWorker, {port});
		utils.getConfiguredWorkerCount.should.have.been.called;
		utils.getActiveWorkers.should.have.been.called;

		cluster.removeListener.should.have.been.called;
	});


	it ('Handles "unknown" message', () => {
		const master = mock.reRequire('../master');
		master.handleMessage({id: 'mock'}, {});

		logger.error.should.have.been.calledOnce;
	});


	it ('Handles "NOTIFY_DEVMODE" message', () => {
		const utils = {
			setConfiguredWorkerCount: sandbox.stub().returns(1)
		};
		mock('../lib/master-utils', utils);
		const master = mock.reRequire('../master');
		master.handleMessage({id: 'mock'}, {cmd: 'NOTIFY_DEVMODE'});

		utils.setConfiguredWorkerCount.should.have.been.calledOnce;
		utils.setConfiguredWorkerCount.should.have.been.calledWith(1);
		logger.error.should.not.have.been.called;
	});


	it ('Handles unknown "WORKER_WANTS_TO_RESTART_THE_POOL"', () => {
		const master = mock.reRequire('../master');
		sandbox.stub(master, 'restartWorkers');
		master.handleMessage({id: 'mock'}, {cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});

		master.restartWorkers.should.have.been.called;
		logger.error.should.not.have.been.called;
	});


	it ('Handles unknown "FATAL_ERROR"', () => {
		const master = mock.reRequire('../master');
		master.handleMessage({id: 'mock'}, {cmd: 'FATAL_ERROR'});

		logger.error.should.have.been.called;
	});


	it ('onWorkerExit() logs, and queues up new workers', () => {
		const master = mock.reRequire('../master');
		sandbox.stub(master, 'maintainWorkerCount');

		master.onWorkerExit({process: {pid: 'mock'}}, 1, 'ERROR'); //error code, maintainWorkerCount should not be called.
		logger.info.should.have.been.called;
		master.maintainWorkerCount.should.not.have.been.called;

		logger.info.reset();
		master.maintainWorkerCount.reset();

		master.onWorkerExit({process: {pid: 'mock'}}, 1); //error code, maintainWorkerCount should not be called.
		logger.info.should.have.been.called;
		master.maintainWorkerCount.should.not.have.been.called;

		logger.info.reset();
		master.maintainWorkerCount.reset();

		master.onWorkerExit({process: {pid: 'mock'}}, 0); //no error code (clean exit), maintainWorkerCount should be called.
		logger.info.should.have.been.called;
		master.maintainWorkerCount.should.have.been.called;
	});


	it ('restartWorkers() should send all curent workers the close message, but only one at a time', () => {
		const once = sandbox.stub();
		const fakeWorkers = Array.from({length: 2}).map(() => ({
			isConnected: () => true,
			send: sandbox.mock().once().withArgs({cmd: 'close'})
		}));
		const utils = {
			getConfiguredWorkerCount: sandbox.stub().returns(1),
			getActiveWorkers: sandbox.stub().returns(fakeWorkers.slice()),
		};

		mock('cluster', {once});
		mock('../lib/master-utils', utils);
		const master = mock.reRequire('../master');

		master.restartWorkers();
		master.restartWorkers();

		fakeWorkers[0].send.verify();
		fakeWorkers[1].send.should.not.have.been.called;
		utils.getActiveWorkers.should.have.been.called;
		utils.getConfiguredWorkerCount.should.have.been.called;

		once.should.have.been.calledOnce;
		once.should.have.been.calledWith('exit');

		const [, continueEventCallback] = once.getCall(0).args;
		continueEventCallback();

		continueEventCallback(); //should noop (we only have two items)

		fakeWorkers[0].send.verify();
		fakeWorkers[1].send.verify();

		once.should.have.been.calledTwice;
		once.should.have.been.calledWith('listening');

	});


});
