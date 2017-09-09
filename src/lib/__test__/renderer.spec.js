/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

const logger = require('../logger');

describe('lib/renderer', () => {
	let sandbox;
	let clientConfig;
	let nodeConfigAsClientConfig;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		sandbox.stub(logger, 'attachToExpress');
		sandbox.stub(logger, 'info');
		sandbox.stub(logger, 'error');
		sandbox.stub(logger, 'warn');
		sandbox.stub(logger, 'debug');

		clientConfig = sandbox.stub().returns({});
		nodeConfigAsClientConfig = sandbox.stub().returns({});

		mock('../config', {clientConfig, nodeConfigAsClientConfig});
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('exports a function to get/make the renderer', () => {
		const {getPageRenderer} = mock.reRequire('../renderer');
		getPageRenderer.should.be.a('function');

		const renderer = getPageRenderer();
		renderer.should.be.a('function');
	});


	it ('renderer: calls app.render twice to pre-flight network calls', () => {
		const {getPageRenderer} = mock.reRequire('../renderer');
		const config = {};
		const serialize = sandbox.stub().returns('testHTML');
		const datacache = {
			getForContext: sandbox.stub().returns({serialize})
		};
		const render = sandbox.stub().returns('TestApp');
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester',
			waitForPending: sandbox.stub()
		};

		const res = {
			end: sandbox.stub(),
			send: sandbox.stub(),
			status: sandbox.stub()
		};
		const next = sandbox.stub();

		const renderer = getPageRenderer({appId, basepath}, config, datacache, render);
		renderer.should.be.a('function');

		return renderer(req, res, next)
			.then(() => {
				next.should.not.have.been.called;
				res.end.should.not.have.been.called;
				res.status.should.not.have.been.called;

				req.waitForPending.should.have.been.calledOnce;
				req.waitForPending.should.have.been.calledWithExactly(5 * 60000);

				clientConfig.should.have.been.calledOnce;
				clientConfig.should.have.been.calledWithExactly(config, req.username, appId, req);

				nodeConfigAsClientConfig.should.have.been.calledOnce;
				nodeConfigAsClientConfig.should.have.been.calledWithExactly(config, appId, req);

				render.should.have.been.calledTwice;
				render.should.have.been.calledWithExactly(basepath, req, sinon.match.object, sinon.match.func);
				render.should.have.been.calledWithExactly(basepath, req, sinon.match.object);
			});
	});


	it ('renderer: not-found', () => {
		const {getPageRenderer} = mock.reRequire('../renderer');
		const config = {};
		const serialize = sandbox.stub().returns('testHTML');
		const datacache = {
			getForContext: sandbox.stub().returns({serialize})
		};
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester'
		};

		const o = {
			render (a,b,c, markNotFound) {
				if (markNotFound) {
					markNotFound();
				}
				return 'Not Found HTML';
			}
		};

		sandbox.spy(o, 'render');

		const res = {
			end: sandbox.stub(),
			send: sandbox.stub(),
			status: sandbox.stub()
		};
		const next = sandbox.stub();

		const renderer = getPageRenderer({appId, basepath}, config, datacache, o.render);
		renderer.should.be.a('function');

		return renderer(req, res, next)
			.then(() => {
				next.should.not.have.been.called;
				res.end.should.not.have.been.called;
				res.status.should.have.been.called;
				res.status.should.have.been.calledWith(404);

				o.render.should.have.been.calledTwice;
			});
	});


	it ('renderer: Error Thrown', () => {
		const {getPageRenderer} = mock.reRequire('../renderer');
		const config = {};
		const serialize = sandbox.stub().returns('testHTML');
		const datacache = {
			getForContext: sandbox.stub().returns({serialize})
		};
		const next = sandbox.stub();
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester'
		};
		const err = new Error('Ooops');

		const render = sandbox.stub().throws(err);



		const res = {
			end: sandbox.stub(),
			send: sandbox.stub(),
			status: sandbox.stub()
		};

		const renderer = getPageRenderer({appId, basepath}, config, datacache, render);
		renderer.should.be.a('function');

		return renderer(req, res, next)
			.then(() => {
				next.should.have.been.calledWith(err);
				res.end.should.not.have.been.called;
				res.status.should.not.have.been.called;

				render.should.have.been.calledOnce;
			});
	});
});
