'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/app-service', () => {
	const cacheBusterMiddleware = Object.freeze({});
	const corsMiddleware = Object.freeze({});

	let cookieParserConstructor;
	let compressionMock;
	let expressMock;
	let expressRequestLanguageMock;
	let staticMock;
	let getPageRenderer;
	let logger;
	let registerEndPoints;
	let sandbox;
	let sessionMock;
	let sessionMockInstance;
	let server;
	let setupDataserver;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			attachToExpress: sandbox.stub(),
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};

		cookieParserConstructor = sandbox.stub().returns('cookie-parser-middleware');
		expressRequestLanguageMock = sandbox.stub().returns('express-request-language-middleware');
		compressionMock = sandbox.stub();

		sessionMockInstance = {
			anonymousMiddleware: sandbox.stub().returns('anonymousMiddleware'),
			middleware: sandbox.stub().returns('authenticatedMiddleware')
		};

		sessionMock = sandbox.stub().returns(sessionMockInstance);

		setupDataserver = sandbox.stub().returns({mockServer: true});

		staticMock = sandbox.stub().returns('staticMiddleware');
		expressMock = Object.assign(
			() => Object.create(expressMock, {
				use: {value: sandbox.stub()},
				get: {value: sandbox.stub()}
			}), { static: staticMock });

		server = Object.freeze(expressMock());

		getPageRenderer = sandbox.stub().returns('page-renderer');
		registerEndPoints = sandbox.stub();

		mock('cookie-parser', cookieParserConstructor);
		mock('express-request-language', expressRequestLanguageMock);
		mock('../logger', logger);
		mock('express', expressMock);
		mock('serve-static', staticMock);
		mock('nti-lib-interfaces', {default: setupDataserver});
		mock('../api', registerEndPoints);
		mock('../compress', {attachToExpress: compressionMock});
		mock('../no-cache', cacheBusterMiddleware);
		mock('../cors', corsMiddleware);
		mock('../session', sessionMock);
		mock('../renderer', {getPageRenderer});

		if (!process.send) {
			process.send = function fakeSend () {};
		}
		sandbox.stub(process, 'send');
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
		if (process.send.name === 'fakeSend') {
			delete process.send;
		}
	});


	it ('neverCacheManifestFiles(): adds no-cache headers for manifests', () => {
		const resp = Object.freeze({});
		const stuby = sandbox.stub();
		mock('../no-cache', stuby);
		const service = mock.reRequire('../app-service');

		service.neverCacheManifestFiles(resp, '/index.html');
		stuby.should.not.have.been.called;
		stuby.reset();

		service.neverCacheManifestFiles(resp, '/index.appcache.html');
		stuby.should.not.have.been.called;
		stuby.reset();

		service.neverCacheManifestFiles(resp, '/index.html.appcache');
		stuby.should.have.been.calledOnce;
		stuby.should.have.been.calledWith(null, resp, sinon.match.func);
		stuby.reset();

		service.neverCacheManifestFiles(resp, '/index.appcache');
		stuby.should.have.been.calledOnce;
		stuby.should.have.been.calledWith(null, resp, sinon.match.func);
		stuby.reset();
	});


	it ('forceError(): throws', () => {
		const service = mock.reRequire('../app-service');

		expect(() => service.forceError()).to.throw();
	});


	it ('resourceNotFound(): sets 404', () => {
		const service = mock.reRequire('../app-service');

		const resp = {
			status () { return this; },
			send () { return this; }
		};

		sandbox.spy(resp, 'status');
		sandbox.spy(resp, 'send');

		service.resourceNotFound(null, resp);
		// res.status(404).send('Asset Not Found');

		resp.status.should.have.been.calledOnce;
		resp.status.should.have.been.calledWithExactly(404);

		resp.send.should.have.been.calledOnce;
		resp.send.should.have.been.calledWithExactly('Asset Not Found');
	});


	it ('contextualize(): nests an express instance under a route', () => {
		const service = mock.reRequire('../app-service');
		sandbox.stub(service, 'setupApplication');
		sandbox.stub(service, 'setupClient');

		const root = '/test';
		const app = expressMock();

		const newApp = service.contextualize(root, app);

		newApp.should.be.ok;
		newApp.should.not.equal(app);

		app.use.should.have.been.calledOnce;
		app.use.should.have.been.calledWith(root, newApp);
	});


	it ('setupApplication(): gathers config, attaches middleware, and sets up all apps', () => {
		const service = mock.reRequire('../app-service');
		sandbox.stub(service, 'setupClient');
		const restartCallback = sandbox.stub();
		const config = Object.freeze({
			test: 'abc',
			port: 123,
			apps: [
				{
					appId: 1
				},
				{
					appId: 2
				}
			]
		});

		const result = service.setupApplication(server, config, restartCallback);

		result.should.be.equal(config.port);

		restartCallback.should.not.have.been.called;

		logger.attachToExpress.should.have.been.calledOnce;
		logger.attachToExpress.should.have.been.calledWith(server);

		service.setupClient.should.have.been.calledTwice;
		service.setupClient.should.have.been.calledWith(config.apps[0]);
		service.setupClient.should.have.been.calledWith(config.apps[1]);

		server.use.should.have.been.calledTwice
			.and.have.been.calledWith('cookie-parser-middleware')
			.and.have.been.calledWith(corsMiddleware);
	});


	it ('setupClient(): expectations (production)', () => {
		const ONE_HOUR = '1 hour';
		const mockReg = {
			assets: 'mock/assets/path',
			devmode: false,
			render: sandbox.stub(),
			sessionSetup: sandbox.stub()
		};

		mock('test-app', {register: sandbox.stub().returns(mockReg)});

		const service = mock.reRequire('../app-service');
		const clientApp = expressMock();
		sandbox.stub(service, 'contextualize').returns(clientApp);

		//the freeze ensures attempts at modifying it will explode.
		const clientConfig = Object.freeze({
			basepath: '/basepath/',
			package: 'test-app'
		});

		const clientConfigWithAssets = Object.assign({assets: mockReg.assets}, clientConfig);

		const params = {
			server,
			config: Object.freeze({mockConfig: true}),
			datacache: Object.freeze({}),
			interface: Object.freeze({}),
			restartRequest: sandbox.stub()
		};

		const ret = service.setupClient(clientConfig, params);

		expect(ret).to.be.undefinded;
		params.restartRequest.should.not.have.been.called;

		service.contextualize.should.have.been.called;

		compressionMock.should.have.been.calledOnce;
		compressionMock.should.have.been.calledWith(clientApp, mockReg.assets);

		staticMock.should.have.been.calledOnce;
		staticMock.should.have.been.calledWith(mockReg.assets);
		staticMock.should.have.been.calledWith(mockReg.assets, sinon.match({maxAge: ONE_HOUR}));

		clientApp.get.should.have.been.calledTwice;
		clientApp.get.should.have.been.calledWith(sinon.match.regexp, service.resourceNotFound);
		clientApp.get.should.have.been.calledWith('*', 'page-renderer');

		registerEndPoints.should.have.been.calledOnce;
		registerEndPoints.should.have.been.calledWith(
			clientApp,
			sinon.match({mockConfig: true, package: 'test-app', basepath: '/basepath/'}),
			params.interface
		);

		clientApp.use.callCount.should.be.equal(6);
		clientApp.use.should.have.been.calledWith('staticMiddleware');
		clientApp.use.should.have.been.calledWith('express-request-language-middleware');
		clientApp.use.should.have.been.calledWith(cacheBusterMiddleware);
		clientApp.use.should.have.been.calledWith(service.FORCE_ERROR_ROUTE, service.forceError);
		clientApp.use.should.have.been.calledWith(service.ANONYMOUS_ROUTES, sinon.match.func);
		clientApp.use.should.have.been.calledWith(service.AUTHENTICATED_ROUTES, sinon.match.func);

		const args = [{}, {}, {}];
		for (let n = 0; n < clientApp.use.callCount; n++) {
			const call = clientApp.use.getCall(n);
			if (call.calledWith(service.ANONYMOUS_ROUTES) || call.calledWith(service.AUTHENTICATED_ROUTES)) {
				call.args[1].apply(null, args);
			}
		}

		sessionMockInstance.anonymousMiddleware.should.have.been.calledOnce;
		sessionMockInstance.anonymousMiddleware.should.have.been.calledWithExactly(clientConfig.basepath, args[0], args[1], args[2]);

		sessionMockInstance.middleware.should.have.been.calledOnce;
		sessionMockInstance.middleware.should.have.been.calledWithExactly(clientConfig.basepath, args[0], args[1], args[2]);

		getPageRenderer.should.have.been.calledOnce;
		getPageRenderer.should.have.been.calledWith(clientConfigWithAssets, params.config, params.datacache, mockReg.render);

		process.send.should.not.have.been.called;
	});


	it ('setupClient(): expectations (devmode)', () => {
		const ONE_HOUR = '1 hour';
		const mockReg = {
			assets: 'mock/assets/path',
			devmode: { start: sandbox.stub() },
			render: sandbox.stub(),
			sessionSetup: sandbox.stub()
		};

		mock('test-app', {register: sandbox.stub().returns(mockReg)});

		const service = mock.reRequire('../app-service');
		const clientApp = expressMock();
		sandbox.stub(service, 'contextualize').returns(clientApp);

		//the freeze ensures attempts at modifying it will explode.
		const clientConfig = Object.freeze({
			basepath: '/basepath/',
			package: 'test-app'
		});

		const clientConfigWithAssets = Object.assign({assets: mockReg.assets}, clientConfig);

		const params = {
			server,
			config: Object.freeze({mockConfig: true}),
			datacache: Object.freeze({}),
			interface: Object.freeze({}),
			restartRequest: sandbox.stub()
		};

		const ret = service.setupClient(clientConfig, params);

		expect(ret).to.be.undefinded;
		params.restartRequest.should.not.have.been.called;

		service.contextualize.should.have.been.called;

		compressionMock.should.have.been.calledOnce;
		compressionMock.should.have.been.calledWith(clientApp, mockReg.assets);

		staticMock.should.have.been.calledOnce;
		staticMock.should.have.been.calledWith(mockReg.assets);
		staticMock.should.have.been.calledWith(mockReg.assets, sinon.match({maxAge: ONE_HOUR}));

		clientApp.get.should.have.been.calledTwice;
		clientApp.get.should.have.been.calledWith(sinon.match.regexp, service.resourceNotFound);
		clientApp.get.should.have.been.calledWith('*', 'page-renderer');

		registerEndPoints.should.have.been.calledOnce;
		registerEndPoints.should.have.been.calledWith(
			clientApp,
			sinon.match({mockConfig: true, package: 'test-app', basepath: '/basepath/'}),
			params.interface
		);

		clientApp.use.callCount.should.be.equal(6);
		clientApp.use.should.have.been.calledWith('staticMiddleware');
		clientApp.use.should.have.been.calledWith('express-request-language-middleware');
		clientApp.use.should.have.been.calledWith(cacheBusterMiddleware);
		clientApp.use.should.have.been.calledWith(service.FORCE_ERROR_ROUTE, service.forceError);
		clientApp.use.should.have.been.calledWith(service.ANONYMOUS_ROUTES, sinon.match.func);
		clientApp.use.should.have.been.calledWith(service.AUTHENTICATED_ROUTES, sinon.match.func);

		const args = [{}, {}, {}];
		for (let n = 0; n < clientApp.use.callCount; n++) {
			const call = clientApp.use.getCall(n);
			if (call.calledWith(service.ANONYMOUS_ROUTES) || call.calledWith(service.AUTHENTICATED_ROUTES)) {
				call.args[1].apply(null, args);
			}
		}

		sessionMockInstance.anonymousMiddleware.should.have.been.calledOnce;
		sessionMockInstance.anonymousMiddleware.should.have.been.calledWithExactly(clientConfig.basepath, args[0], args[1], args[2]);

		sessionMockInstance.middleware.should.have.been.calledOnce;
		sessionMockInstance.middleware.should.have.been.calledWithExactly(clientConfig.basepath, args[0], args[1], args[2]);

		getPageRenderer.should.have.been.calledOnce;
		getPageRenderer.should.have.been.calledWith(clientConfigWithAssets, params.config, params.datacache, mockReg.render);

		process.send.should.have.been.calledOnce;
		process.send.should.have.been.calledWith(sinon.match({cmd: 'NOTIFY_DEVMODE'}));
		mockReg.devmode.start.should.have.been.calledOnce;
	});
});
