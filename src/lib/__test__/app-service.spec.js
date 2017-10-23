/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

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
	let sessionMock;
	let sessionMockInstance;
	let server;
	let setupDataserver;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		cookieParserConstructor = jest.fn(() => 'cookie-parser-middleware');
		expressRequestLanguageMock = jest.fn(() => 'express-request-language-middleware');
		compressionMock = jest.fn();

		sessionMockInstance = {
			anonymousMiddleware: jest.fn(() => 'anonymousMiddleware'),
			middleware: jest.fn(() => 'authenticatedMiddleware')
		};

		sessionMock = jest.fn(() => sessionMockInstance);

		setupDataserver = jest.fn(() => ({mockServer: true}));

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
		jest.doMock('express-request-language', () => expressRequestLanguageMock);
		jest.doMock('../logger', () => logger);
		jest.doMock('express', () => expressMock);
		jest.doMock('serve-static', () => staticMock);
		jest.doMock('nti-lib-interfaces', () => ({default: setupDataserver}));
		jest.doMock('../api', () => registerEndPoints);
		jest.doMock('../compress', () => ({attachToExpress: compressionMock}));
		jest.doMock('../no-cache', () => cacheBusterMiddleware);
		jest.doMock('../cors', () => corsMiddleware);
		jest.doMock('../session', () => sessionMock);
		jest.doMock('../renderer', () => ({getPageRenderer}));

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
		expect(stuby).toHaveBeenCalledWith(null, resp, expect.any(Function));
		stuby.mockClear();

		service.neverCacheManifestFiles(resp, '/index.appcache');
		expect(stuby).toHaveBeenCalledTimes(1);
		expect(stuby).toHaveBeenCalledWith(null, resp, expect.any(Function));
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


	test ('setupApplication(): gathers config, attaches middleware, and sets up all apps', () => {
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

		service.setupApplication(server, config, restartCallback);

		expect(restartCallback).not.toHaveBeenCalled();

		expect(logger.attachToExpress).toHaveBeenCalledTimes(1);
		expect(logger.attachToExpress).toHaveBeenCalledWith(server);

		expect(service.setupClient).toHaveBeenCalledTimes(2);
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[0], expect.any(Object));
		expect(service.setupClient).toHaveBeenCalledWith(config.apps[1], expect.any(Object));

		expect(server.use).toHaveBeenCalledTimes(2);
		expect(server.use).toHaveBeenCalledWith('cookie-parser-middleware');
		expect(server.use).toHaveBeenCalledWith(corsMiddleware);
	});


	test ('setupClient(): expectations (production)', async () => {
		const ONE_HOUR = '1 hour';
		const mockReg = {
			assets: 'mock/assets/path',
			devmode: false,
			render: jest.fn(),
			sessionSetup: jest.fn()
		};

		jest.doMock('test-app', () => ({register: jest.fn(() => mockReg)}), {virtual: true});

		const service = require('../app-service');
		const clientApp = expressMock();
		stub(service, 'contextualize', () => clientApp);

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
			expect.objectContaining({mockConfig: true, package: 'test-app', basepath: '/basepath/'}),
			params.interface
		);

		expect(clientApp.use.mock.calls.length).toEqual(6);
		expect(clientApp.use).toHaveBeenCalledWith('staticMiddleware');
		expect(clientApp.use).toHaveBeenCalledWith('express-request-language-middleware');
		expect(clientApp.use).toHaveBeenCalledWith(cacheBusterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(service.FORCE_ERROR_ROUTE, service.forceError);
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
		expect(getPageRenderer).toHaveBeenCalledWith(clientConfigWithAssets, params.config, params.datacache, mockReg.render, undefined);

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

		jest.doMock('test-app', () => ({register: jest.fn(() => mockReg)}), {virtual: true});

		const service = require('../app-service');
		const clientApp = expressMock();
		stub(service, 'contextualize', () => clientApp);

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
			expect.objectContaining({mockConfig: true, package: 'test-app', basepath: '/basepath/'}),
			params.interface
		);

		expect(clientApp.use.mock.calls.length).toEqual(6);
		expect(clientApp.use).toHaveBeenCalledWith('staticMiddleware');
		expect(clientApp.use).toHaveBeenCalledWith('express-request-language-middleware');
		expect(clientApp.use).toHaveBeenCalledWith(cacheBusterMiddleware);
		expect(clientApp.use).toHaveBeenCalledWith(service.FORCE_ERROR_ROUTE, service.forceError);
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
		expect(getPageRenderer).toHaveBeenCalledWith(clientConfigWithAssets, params.config, params.datacache, mockReg.render, undefined);

		expect(process.send).toHaveBeenCalledTimes(1);
		expect(process.send).toHaveBeenCalledWith(expect.objectContaining({cmd: 'NOTIFY_DEVMODE'}));
		expect(mockReg.devmode.start).toHaveBeenCalledTimes(1);
	});
});
