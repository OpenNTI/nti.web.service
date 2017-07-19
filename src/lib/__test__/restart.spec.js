/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/restart', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('exports a restart function', () => {
		const {restart: fn} = mock.reRequire('../restart');

		fn.should.be.a('function');
		fn.length.should.be.equal(0);
	});


	it ('restart() sends WORKER_WANTS_TO_RESTART_THE_POOL', () => {
		const stubby = sandbox.stub();
		const send = process.send
			? (sandbox.stub(process, 'send'), process.send)
			: (process.send = stubby);

		const {restart} = mock.reRequire('../restart');

		restart();

		if (send === stubby) {
			delete process.send;
		}

		send.should.have.been.calledOnce;
		send.should.have.been.calledWith({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
	});

});
