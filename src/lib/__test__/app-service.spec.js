/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/app-service', () => {
	const cacheBusterMiddleware = Object.freeze({});
	const corsMiddleware = Object.freeze({});
	const foMiddleware = Object.freeze({});
	const unsupportedMiddleware = Object.freeze({});

	let htmlAcceptsFilterMiddleware;
	let apiProxyMiddleware;
	let cookieParserConstructor;
	let compressionMock;
	let expressMock;
	let expressRequestLanguageMock;
	let staticMock;
	let getPageRenderer;
	let logger;
	let registerEndPoints;
	let sessionMock;
	let sessionMockInstance;
	let server;
	let setupDataserver;
	let restartOnModification;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		htmlAcceptsFilterMiddleware = jest.fn(() => 'htmlAcceptsFilterMiddleware');
		apiProxyMiddleware = jest.fn(() => 'apiProxyMiddleware');
		cookieParserConstructor = jest.fn(() => 'cookie-parser-middleware');
		expressRequestLanguageMock = jest.fn(() => 'express-request-language-middleware');
		compressionMock = jest.fn();

		sessionMockInstance = {
			anonymousMiddleware: jest.fn(() => 'anonymousMiddleware'),
			middleware: jest.fn(() => 'authenticatedMiddleware')
		};

		sessionMock = jest.fn(() => sessionMockInstance);

		setupDataserver = jest.fn(() => ({mockServer: true}));
		restartOnModification = jest.fn();

		staticMock = jest.fn(() => 'staticMiddleware');

		expressMock = Object.assign(
			() => Object.create(expressMock, {
				use: {value: jest.fn()},
				set: {value: jest.fn()},
				get: {value: jest.fn()}
			}), { static: staticMock });

		server = Object.freeze(expressMock());

		getPageRenderer = jest.fn(() => 'page-renderer');
		registerEndPoints = jest.fn();


		jest.doMock('cookie-parser', () => cookieParserConstructor);
		jest.doMock('cors', () => () => corsMiddleware);
		jest.doMock('express-request-language', () => expressRequestLanguageMock);
		jest.doMock('express', () => expressMock);
		jest.doMock('serve-static', () => staticMock);
		jest.doMock('@nti/lib-interfaces', () => ({default: setupDataserver}));
		jest.doMock('../accepts-filters', () => ({htmlAcceptsFilter: htmlAcceptsFilterMiddleware}));
		jest.doMock('../api', () => registerEndPoints);
		jest.doMock('../api-proxy', () => apiProxyMiddleware);
		jest.doMock('../compress', () => ({attachToExpress: compressionMock}));
		jest.doMock('../frame-options', () => foMiddleware);
		jest.doMock('../logger', () => logger);
		jest.doMock('../no-cache', () => cacheBusterMiddleware);
		jest.doMock('../renderer', () => ({getPageRenderer}));
		jest.doMock('../restart', () => ({restartOnModification}));
		jest.doMock('../session', () => sessionMock);
		jest.doMock('../unsupported', () => () => unsupportedMiddleware);

		if (!process.send) {
			process.send = function fakeSend () {};
		}
		stub(process, 'send');
	});

	afterEach(() => {
		jest.resetModules();
		if (process.send.name === 'fakeSend') {
			delete process.send;
		}
	});


	test ('neverCacheManifestFiles(): adds no-cache headers for manifests', () => {
		const resp = Object.freeze({});
		const stuby = jest.fn();
		jest.doMock('../no-cache', () => stuby);
		const service = require('../app-service');

		service.neverCacheManifestFiles(resp, '/index.html');
		expect(stuby).not.toHaveBeenCalled();
		stuby.mockClear();

		service.neverCacheManifestFiles(resp, '/index.appcache.html');
		expect(stuby).not.toHaveBeenCalled();
		stuby.mockClear();

		service.neverCacheManifestFiles(resp, '/index.html.appcache');
		expect(stuby).toHaveBeenCalledTimes(1);
		expect(stuby).toHaveBeenCalledWith(null, resp);
		stuby.mockClear();

		service.neverCacheManifestFiles(resp, '/index.appcache');
		expect(stuby).toHaveBeenCalledTimes(1);
		expect(stuby).toHaveBeenCalledWith(null, resp);
	});


	test ('forceError(): throws', () => {
		const service = require('../app-service');

		expect(() => service.forceError()).toThrow();
	});


	test ('resourceNotFound(): sets 404', () => {
		const service = require('../app-service');

		const resp = {
			status () { return this; },
			send () { return this; }
		};

		jest.spyOn(resp, 'status');
		jest.spyOn(resp, 'send');

		service.resourceNotFound(null, resp);
		// res.status(404).send('Asset Not Found');

		expect(resp.status).toHaveBeenCalledTimes(1);
		expect(resp.status).toHaveBeenCalledWith(404);

		expect(resp.send).toHaveBeenCalledTimes(1);
		expect(resp.send).toHaveBeenCalledWith('Asset Not Found');
	});


	test ('contextualize(): nests an express instance under a route', () => {
		const service = require('../app-service');
		stub(service, 'setupApplication');
		stub(service, 'setupClient');

		const root = '/test';
		const app = expressMock();

		const newApp = service.contextualize(root, app);

		expect(newApp).toBeTruthy();
		expect(newApp).not.toBe(app);

		expect(app.use).toHaveBeenCalledTimes(1);
		expect(app.use).toHaveBeenCalledWith(root, newApp);
	});


	test ('setupApplication(): gathers config, attaches middleware, and sets up all apps', async () => {
		const service = require('../app-service');
		stub(service, 'setupClient');
		const restartCallback = jest.fn();
		const config = Object.freeze({
			test: 'abc',
			apps: [
				{
					appId: 1
				},
				{
					appId: 2
				}
			]
		});

		await service.setupApplication(server, config, restartCallback);

		expect(restartCallback).not.toHaveBeenCalled();

		expect(logger.attachToExpress).toHaveBeenCalledTimes(1);
		expect(logger.attachToExpress).toHaveBeenCalledWith(server);

		expect(service.setupClient).toHaveBeenCalledTimes(2);
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[0], expect.any(Object));
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[1], expect.any(Object));

		expect(server.use).toHaveBeenCalledTimes(4);
		expect(server.use).toHaveBeenCalledWith('cookie-parser-middleware');
		expect(server.use).toHaveBeenCalledWith(corsMiddleware);
		expect(server.use).toHaveBeenCalledWith(foMiddleware);
		expect(server.use).toHaveBeenCalledWith(expect.any(RegExp), unsupportedMiddleware);

		expect(apiProxyMiddleware).not.toHaveBeenCalled();
	});


	test ('setupApplication(): dev mode does not attach logger middleware', async () => {
		const service = require('../app-service');
		stub(service, 'setupClient');
		const restartCallback = jest.fn();
		const config = Object.freeze({
			mode: 'development',
			test: 'abc',
			apps: [
				{
					appId: 1
				},
				{
					appId: 2
				}
			]
		});

		logger.attachToExpress.mockClear();

		await service.setupApplication(server, config, restartCallback);

		expect(restartCallback).not.toHaveBeenCalled();

		expect(logger.attachToExpress).not.toHaveBeenCalled();

		expect(service.setupClient).toHaveBeenCalledTimes(2);
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[0], expect.any(Object));
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[1], expect.any(Object));

		expect(server.use).toHaveBeenCalledTimes(4);
		expect(server.use).toHaveBeenCalledWith('cookie-parser-middleware');
		expect(server.use).toHaveBeenCalledWith(corsMiddleware);
		expect(server.use).toHaveBeenCalledWith(foMiddleware);
		expect(server.use).toHaveBeenCalledWith(expect.any(RegExp), unsupportedMiddleware);
	});

	test ('setupApplication(): with proxy, dev mode does not attach logger middleware', async () => {
		const service = require('../app-service');
		stub(service, 'setupClient');
		const restartCallback = jest.fn();
		const config = Object.freeze({
			mode: 'development',
			test: 'abc',
			apps: [
				{
					appId: 1
				},
				{
					appId: 2
				}
			],
			proxy: 'http://test'
		});

		logger.attachToExpress.mockClear();

		await service.setupApplication(server, config, restartCallback);

		expect(restartCallback).not.toHaveBeenCalled();

		expect(logger.attachToExpress).not.toHaveBeenCalled();

		expect(service.setupClient).toHaveBeenCalledTimes(2);
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[0], expect.any(Object));
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[1], expect.any(Object));

		expect(server.use).toHaveBeenCalledTimes(5);
		expect(server.use).toHaveBeenCalledWith('*', 'apiProxyMiddleware');
		expect(server.use).toHaveBeenCalledWith('cookie-parser-middleware');
		expect(server.use).toHaveBeenCalledWith(corsMiddleware);
		expect(server.use).toHaveBeenCalledWith(foMiddleware);
		expect(server.use).toHaveBeenCalledWith(expect.any(RegExp), unsupportedMiddleware);

		expect(apiProxyMiddleware).toHaveBeenCalledTimes(1);
		expect(apiProxyMiddleware).toHaveBeenCalledWith(config);
	});


	test ('setupClient(): module failure', async () => {
		const mockModule = {
			register: jest.fn(() => {throw new Error();})
		};

		jest.doMock('test-app0', () => mockModule, {virtual: true});

		const service = require('../app-service');
		const clientApp = expressMock();
		stub(service, 'contextualize', () => clientApp);

		//the freeze ensures attempts at modifying it will explode.
		const clientConfig = Object.freeze({
			basepath: '/basepath0/',
			package: 'test-app0'
		});

		const params = {
			server,
			config: Object.freeze({mockConfig: true}),
			datacache: Object.freeze({}),
			interface: Object.freeze({}),
			restartRequest: jest.fn()
		};

		stub(process, 'exit');
		await service.setupClient(clientConfig, params);

		expect(process.exit).toHaveBeenCalled();
	});


	test ('setupClient(): expectations (production)', async () => {
		const ONE_HOUR = '1 hour';
		const mockReg = {
			assets: 'mock/assets/path',
			devmode: false,
			render: jest.fn(),
			sessionSetup: jest.fn()
		};


		const mockModule = {
			__mockResolve: () => 'foo',
			register: jest.fn(() => mockReg)
		};

		jest.doMock('test-app1', () => mockModule, {virtual: true});

		const tagger = () => {};
		const service = require('../app-service');
		const clientApp = expressMock();
		stub(service, 'contextualize', () => clientApp);
		stub(service, 'setupInterface', () => tagger);

		//the freeze ensures attempts at modifying it will explode.
		const clientConfig = Object.freeze({
			basepath: '/basepath1/',
			package: 'test-app1'
		});

		const clientConfigWithAssets = {assets: mockReg.assets, devmode: false, ...clientConfig};

		const params = {
			server,
			config: Object.freeze({mockConfig: true}),
			restartRequest: jest.fn()
		};

		const ret = await service.setupClient(clientConfig, params);

		expect(ret).not.toBeDefined();
		expect(params.restartRequest).not.toHaveBeenCalled();

		expect(restartOnModification).toHaveBeenCalledTimes(1);
		expect(restartOnModification).toHaveBeenCalledWith('foo');

		expect(service.contextualize).toHaveBeenCalled();

		expect(compressionMock).toHaveBeenCalledTimes(1);
		expect(compressionMock).toHaveBeenCalledWith(clientApp, mockReg.assets);

		expect(staticMock).toHaveBeenCalledTimes(1);
		expect(staticMock).toHaveBeenCalledWith(mockReg.assets, expect.any(Object));
		expect(staticMock).toHaveBeenCalledWith(mockReg.assets, expect.objectContaining({maxAge: ONE_HOUR}));

		expect(clientApp.get).toHaveBeenCalledTimes(2);
		expect(clientApp.get).toHaveBeenCalledWith(expect.any(RegExp), service.resourceNotFound);
		expect(clientApp.get).toHaveBeenCalledWith('*', 'page-renderer');

		expect(registerEndPoints).toHaveBeenCalledTimes(1);
		expect(registerEndPoints).toHaveBeenCalledWith(
			clientApp,
			expect.objectContaining({mockConfig: true, package: 'test-app1', basepath: '/basepath1/'}),
			expect.any(Function)
		);

		expect(clientApp.use.mock.calls.length).toEqual(8);
		expect(clientApp.use).toHaveBeenCalledWith('staticMiddleware');
		expect(clientApp.use).toHaveBeenCalledWith('express-request-language-middleware');
		expect(clientApp.use).toHaveBeenCalledWith(cacheBusterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(tagger);
		expect(clientApp.use).toHaveBeenCalledWith(service.FORCE_ERROR_ROUTE, service.forceError);
		expect(clientApp.use).toHaveBeenCalledWith(htmlAcceptsFilterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(service.ANONYMOUS_ROUTES, expect.any(Function));
		expect(clientApp.use).toHaveBeenCalledWith(service.AUTHENTICATED_ROUTES, expect.any(Function));

		const args = [{}, {}, {}];
		for (let n = 0; n < clientApp.use.mock.calls.length; n++) {
			const [param, fn] = clientApp.use.mock.calls[n];
			if (param === service.ANONYMOUS_ROUTES || param === service.AUTHENTICATED_ROUTES) {
				fn.apply(null, args);
			}
		}

		expect(sessionMockInstance.anonymousMiddleware).toHaveBeenCalledTimes(1);
		expect(sessionMockInstance.anonymousMiddleware).toHaveBeenCalledWith(clientConfig.basepath, args[0], args[1], args[2]);

		expect(sessionMockInstance.middleware).toHaveBeenCalledTimes(1);
		expect(sessionMockInstance.middleware).toHaveBeenCalledWith(clientConfig.basepath, args[0], args[1], args[2]);

		expect(getPageRenderer).toHaveBeenCalledTimes(1);
		expect(getPageRenderer).toHaveBeenCalledWith(clientConfigWithAssets, params.config, mockReg.render, undefined);

		expect(process.send).not.toHaveBeenCalled();
	});


	test ('setupClient(): expectations (devmode)', async () => {
		const ONE_HOUR = '1 hour';
		const mockReg = {
			assets: 'mock/assets/path',
			devmode: { start: jest.fn() },
			render: jest.fn(),
			sessionSetup: jest.fn()
		};

		jest.doMock('test-app2', () => ({register: jest.fn(() => mockReg)}), {virtual: true});

		const tagger = () => {};
		const service = require('../app-service');
		const clientApp = expressMock();
		stub(service, 'contextualize', () => clientApp);
		stub(service, 'setupInterface', () => tagger);

		//the freeze ensures attempts at modifying it will explode.
		const clientConfig = Object.freeze({
			basepath: '/basepath/',
			package: 'test-app2'
		});

		const clientConfigWithAssets = {assets: mockReg.assets, devmode: mockReg.devmode, ...clientConfig};

		const params = {
			server,
			config: Object.freeze({mockConfig: true}),
			restartRequest: jest.fn()
		};

		const ret = await service.setupClient(clientConfig, params);

		expect(ret).not.toBeDefined();
		expect(params.restartRequest).not.toHaveBeenCalled();

		expect(service.contextualize).toHaveBeenCalled();

		expect(compressionMock).toHaveBeenCalledTimes(1);
		expect(compressionMock).toHaveBeenCalledWith(clientApp, mockReg.assets);

		expect(staticMock).toHaveBeenCalledTimes(1);
		expect(staticMock).toHaveBeenCalledWith(mockReg.assets, expect.any(Object));
		expect(staticMock).toHaveBeenCalledWith(mockReg.assets, expect.objectContaining({maxAge: ONE_HOUR}));

		expect(clientApp.get).toHaveBeenCalledTimes(2);
		expect(clientApp.get).toHaveBeenCalledWith(expect.any(RegExp), service.resourceNotFound);
		expect(clientApp.get).toHaveBeenCalledWith('*', 'page-renderer');

		expect(registerEndPoints).toHaveBeenCalledTimes(1);
		expect(registerEndPoints).toHaveBeenCalledWith(
			clientApp,
			expect.objectContaining({mockConfig: true, package: 'test-app2', basepath: '/basepath/'}),
			expect.any(Function)
		);

		expect(clientApp.use.mock.calls.length).toEqual(8);
		expect(clientApp.use).toHaveBeenCalledWith('staticMiddleware');
		expect(clientApp.use).toHaveBeenCalledWith('express-request-language-middleware');
		expect(clientApp.use).toHaveBeenCalledWith(cacheBusterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(tagger);
		expect(clientApp.use).toHaveBeenCalledWith(service.FORCE_ERROR_ROUTE, service.forceError);
		expect(clientApp.use).toHaveBeenCalledWith(htmlAcceptsFilterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(service.ANONYMOUS_ROUTES, expect.any(Function));
		expect(clientApp.use).toHaveBeenCalledWith(service.AUTHENTICATED_ROUTES, expect.any(Function));

		const args = [{}, {}, {}];
		for (let n = 0; n < clientApp.use.mock.calls.length; n++) {
			const [param, fn] = clientApp.use.mock.calls[n];
			if (param === service.ANONYMOUS_ROUTES || param === service.AUTHENTICATED_ROUTES) {
				fn.apply(null, args);
			}
		}

		expect(sessionMockInstance.anonymousMiddleware).toHaveBeenCalledTimes(1);
		expect(sessionMockInstance.anonymousMiddleware).toHaveBeenCalledWith(clientConfig.basepath, args[0], args[1], args[2]);

		expect(sessionMockInstance.middleware).toHaveBeenCalledTimes(1);
		expect(sessionMockInstance.middleware).toHaveBeenCalledWith(clientConfig.basepath, args[0], args[1], args[2]);

		expect(getPageRenderer).toHaveBeenCalledTimes(1);
		expect(getPageRenderer).toHaveBeenCalledWith(clientConfigWithAssets, params.config, mockReg.render, undefined);

		expect(process.send).toHaveBeenCalledTimes(1);
		expect(process.send).toHaveBeenCalledWith(expect.objectContaining({cmd: 'NOTIFY_DEVMODE'}));
		expect(mockReg.devmode.start).toHaveBeenCalledTimes(1);
	});
});
