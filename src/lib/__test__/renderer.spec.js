'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/renderer', () => {
	let logger;
	let sandbox;
	let clientConfig;
	let nodeConfigAsClientConfig;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			attachToExpress: sandbox.stub(),
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};

		clientConfig = sandbox.stub().returns({});
		nodeConfigAsClientConfig = sandbox.stub().returns({});

		mock('../logger', logger);
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

		const renderer = getPageRenderer({appId, basepath}, config, datacache, render);
		renderer.should.be.a('function');

		return renderer(req, res)
			.then(() => {
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

		const renderer = getPageRenderer({appId, basepath}, config, datacache, o.render);
		renderer.should.be.a('function');

		return renderer(req, res)
			.then(() => {
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
		const appId = 'test';
		const basepath = '/mocks/';
		const req = {
			url: '/test',
			username: 'tester'
		};

		const render = sandbox.stub().throws(new Error('Ooops'));



		const res = {
			end: sandbox.stub(),
			send: sandbox.stub(),
			status: sandbox.stub()
		};

		const renderer = getPageRenderer({appId, basepath}, config, datacache, render);
		renderer.should.be.a('function');

		return renderer(req, res)
			.then(() => {
				res.end.should.have.been.called;
				res.status.should.have.been.called;
				res.status.should.have.been.calledWith(500);

				render.should.have.been.calledOnce;
			});
	});
});
