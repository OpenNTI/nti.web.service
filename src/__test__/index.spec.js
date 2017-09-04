/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('Bootstraps', () => {
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
		mock('../polyfills', {});
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('isMaster: true, master bootstraps. not worker.', () => {
		const master = sandbox.spy();
		const worker = sandbox.spy();
		mock('cluster', {isMaster: true});
		mock('../master', {start: master});
		mock('../worker', {start: worker});

		const {run} = mock.reRequire('../index');
		run();

		master.should.have.been.calledOnce;
		master.should.have.been.calledWith();
		master.should.have.been.calledOn(void 0);
		worker.called.should.not.be.true;
	});

	it ('isMaster: false, worker bootstraps. not master.', () => {
		const master = sandbox.spy();
		const worker = sandbox.spy();
		mock('cluster', {isMaster: false});
		mock('../master', {start: master});
		mock('../worker', {start: worker});

		const {run} = mock.reRequire('../index');
		run();

		worker.should.have.been.calledOnce;
		worker.should.have.been.calledWith();
		worker.should.have.been.calledOn(void 0);
		master.should.not.have.been.called;
	});

});
