/*eslint-env jest*/
'use strict';
const { SERVER_REF } = require('../../constants');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/session', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('Session is a Class', () => {
		const Session = require('../index');

		expect(Session).toEqual(expect.any(Function));
		expect(Session.prototype).not.toBe(Object.prototype);
	});

	test('Session constructor assigns server, and sessionSetup callback to self', () => {
		const Session = require('../index');
		const sessionSetup = jest.fn();
		const session = new Session(sessionSetup);

		expect(session.sessionSetup).toBe(sessionSetup);
		expect(sessionSetup).not.toHaveBeenCalled();
	});

	test('Session::getUser() - fulfills with the username of the active user (resolved from the Title of the User workspace on the service document)', () => {
		const workspace = { Title: 'testuser' };
		const Session = require('../index');
		const session = new Session();
		const doc = { getUserWorkspace: jest.fn(() => workspace) };
		stub(session, 'getServiceDocument', () => Promise.resolve(doc));

		const test = context =>
			session.getUser(context).then(name => {
				expect(name).toEqual(workspace.Title);
				expect(session.getServiceDocument).toHaveBeenCalledWith(
					context
				);
				expect(doc.getUserWorkspace).toHaveBeenCalledWith();
			});

		return Promise.resolve() //sequential not parallel!
			.then(() => test())
			.then(() => test({}));
	});

	test('Session::getUser() - error case - no user workspace', () => {
		const Session = require('../index');
		const session = new Session();
		const doc = { getUserWorkspace: jest.fn() };
		stub(session, 'getServiceDocument', () => Promise.resolve(doc));

		const test = context =>
			session
				.getUser(context)
				.then(() =>
					Promise.reject(
						'Unexpected Promise fulfillment. It should have failed.'
					)
				)
				.catch(error => {
					expect(error).toEqual('No user workspace');
					expect(session.getServiceDocument).toHaveBeenCalledWith(
						context
					);
					expect(doc.getUserWorkspace).toHaveBeenCalledWith();
				});

		return Promise.resolve() //sequential not parallel!
			.then(() => test())
			.then(() => test({}));
	});

	test('Session::getServiceDocument() - resolve the service document through a ping/handshake. Stash the logout-url.', () => {
		const Session = require('../index');
		const doc = {};
		const getServiceDocument = jest.fn(() => Promise.resolve(doc));
		const context = { [SERVER_REF]: { getServiceDocument } };
		const session = new Session();

		return session.getServiceDocument(context).then(resolved => {
			expect(doc).toEqual(resolved);

			expect(getServiceDocument).toHaveBeenCalledTimes(1);
			expect(getServiceDocument).toHaveBeenCalledWith(context);
		});
	});

	test('Session::setupInitialData() - get the service document, stash it on the context, call sessionSetup callback', () => {
		const Session = require('../index');
		const setup = jest.fn();

		const service = {};
		const getServiceDocument = jest.fn(() => Promise.resolve(service));
		const context = { [SERVER_REF]: { getServiceDocument }, url: '...' };
		const session = new Session(setup);

		return session.setupInitialData(context).then(() => {
			expect(getServiceDocument).toHaveBeenCalledTimes(1);
			expect(getServiceDocument).toHaveBeenCalledWith(context);

			expect(setup).toHaveBeenCalledTimes(1);
			expect(setup).toHaveBeenCalledWith(service);
		});
	});

	test('Session::middleware() - gets the user, assigns it to the request context, and setups up initial data', () => {
		const Session = require('../index');
		const session = new Session();
		stub(session, 'getUser', () => Promise.resolve('testuser'));
		stub(session, 'setupInitialData');
		//Continue the rejections...we will test this function by itself.
		stub(session, 'maybeRedirect', () => e => Promise.reject(e));

		const next = jest.fn();
		const basepath = '';

		const resp = {
			set: jest.fn(),
			redirect: jest.fn(),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: jest.fn(),
			},

			emit: jest.fn(),
			once: jest.fn(),
			removeListener: jest.fn(),
			setMaxListeners: jest.fn(),
		};

		return session.middleware(basepath, req, resp, next).then(() => {
			expect(req.setMaxListeners).toHaveBeenCalledTimes(1);
			expect(req.setMaxListeners).toHaveBeenCalledWith(1000);

			expect(req.socket.setKeepAlive).toHaveBeenCalledTimes(1);
			expect(req.socket.setKeepAlive).toHaveBeenCalledWith(true, 1000);

			expect(session.getUser).toHaveBeenCalledTimes(1);
			expect(session.getUser).toHaveBeenCalledWith(req);

			expect(req.username).toEqual('testuser');

			expect(session.setupInitialData).toHaveBeenCalledTimes(1);
			expect(session.setupInitialData).toHaveBeenCalledWith(req);

			expect(next).toHaveBeenCalledTimes(1);
			expect(next).toHaveBeenCalledWith();
		});
	});

	test('Session::middleware() - error case: closed connection', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';

		const resp = {
			set: jest.fn(),
			redirect: jest.fn(),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: jest.fn(),
			},

			emit: jest.fn(),
			once(event, cb) {
				if (event === 'close') {
					req['____forceClose'] = cb;
				}
			},
			removeListener: jest.fn(),
			setMaxListeners: jest.fn(),
		};

		stub(
			session,
			'getUser',
			() => (req['____forceClose'](), Promise.resolve('testuser'))
		);
		stub(session, 'setupInitialData');
		//Continue the rejections...we will test this function by itself.
		stub(session, 'maybeRedirect', () => e => Promise.reject(e));

		return session.middleware(basepath, req, resp, next).then(() => {
			expect(session.getUser).toHaveBeenCalledTimes(1);
			expect(session.getUser).toHaveBeenCalledWith(req);

			expect(req.username).toEqual('testuser');

			expect(session.setupInitialData).not.toHaveBeenCalled();

			expect(next).toHaveBeenCalledTimes(1);
			expect(next).toHaveBeenCalledWith('aborted');
		});
	});

	test('Session::middleware() - error case: getUser rejects', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '';

		const resp = {
			set: jest.fn(),
			redirect: jest.fn(),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: jest.fn(),
			},

			emit: jest.fn(),
			once: jest.fn(),
			removeListener: jest.fn(),
			setMaxListeners: jest.fn(),
		};

		stub(session, 'getUser', () => Promise.reject('Test'));
		stub(session, 'setupInitialData');
		//Continue the rejections...we will test this function by itself.
		stub(session, 'maybeRedirect', () => e => Promise.reject(e));

		return session.middleware(basepath, req, resp, next).then(() => {
			expect(session.getUser).toHaveBeenCalledTimes(1);
			expect(session.getUser).toHaveBeenCalledWith(req);

			expect(session.setupInitialData).not.toHaveBeenCalled();

			expect(next).toHaveBeenCalledTimes(1);
			expect(next).toHaveBeenCalledWith('Test');
		});
	});

	test('Session::middleware() - error case: setupInitialData rejects', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '';

		const resp = {
			set: jest.fn(),
			redirect: jest.fn(),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: jest.fn(),
			},

			emit: jest.fn(),
			once(event, cb) {
				if (event === 'close') {
					req['____forceClose'] = cb;
				}
			},
			removeListener: jest.fn(),
			setMaxListeners: jest.fn(),
		};

		stub(session, 'getUser', () => Promise.resolve('testuser'));
		stub(session, 'setupInitialData', () => Promise.reject('Ooops'));
		//Continue the rejections...we will test this function by itself.
		stub(session, 'maybeRedirect', () => e => Promise.reject(e));

		return session.middleware(basepath, req, resp, next).then(() => {
			expect(session.getUser).toHaveBeenCalledTimes(1);
			expect(session.getUser).toHaveBeenCalledWith(req);

			expect(req.username).toEqual('testuser');

			expect(session.setupInitialData).toHaveBeenCalledTimes(1);
			expect(session.setupInitialData).toHaveBeenCalledWith(req);

			expect(next).toHaveBeenCalledTimes(1);
			expect(next).toHaveBeenCalledWith('Ooops');
		});
	});

	test('Session::middleware() - failing to set headers does not kill the response', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '';

		const resp = {
			set: jest.fn(() => {
				throw new Error("Shoot. :'(");
			}),
			redirect: jest.fn(),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: jest.fn(),
			},

			emit: jest.fn(),
			once: jest.fn(),
			removeListener: jest.fn(),
			setMaxListeners: jest.fn(),
		};

		stub(session, 'getUser', () => Promise.resolve('testuser'));
		stub(session, 'setupInitialData');
		//Continue the rejections...we will test this function by itself.
		stub(session, 'maybeRedirect', () => e => Promise.reject(e));

		return session.middleware(basepath, req, resp, next).then(() => {
			expect(session.getUser).toHaveBeenCalledTimes(1);
			expect(session.getUser).toHaveBeenCalledWith(req);

			expect(req.username).toEqual('testuser');

			expect(session.setupInitialData).toHaveBeenCalledTimes(1);
			expect(session.setupInitialData).toHaveBeenCalledWith(req);

			expect(next).toHaveBeenCalledTimes(1);
			expect(next).toHaveBeenCalledWith();
		});
	});

	test('Session::maybeRedirect() - go to login', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		let ret;
		expect(() => (ret = callback())).not.toThrow();
		expect(ret).toEqual('redirected');
		expect(resp.redirect).toHaveBeenCalledTimes(1);
		expect(resp.redirect).toHaveBeenCalledWith(
			'/login/?return=original-url'
		);
		expect(next).not.toHaveBeenCalled();
	});

	test('Session::maybeRedirect() - drop on dead', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		req.dead = true;
		let ret;
		expect(() => (ret = callback())).not.toThrow();
		expect(ret).toBe(undefined);
		expect(next).not.toHaveBeenCalled();
	});

	test('Session::maybeRedirect() - redirect to login without return param if at root', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		let ret;
		expect(() => (ret = callback({ statusCode: 401 }))).not.toThrow();
		expect(ret).toEqual('redirected');
		expect(resp.redirect).toHaveBeenCalledTimes(1);
		expect(resp.redirect).toHaveBeenCalledWith('/login/');
		expect(next).not.toHaveBeenCalled();
	});

	test('Session::maybeRedirect() - does not redirect to login if route is login', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = 'login';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		return Promise.resolve(callback('123')).catch(reason => {
			expect(reason).toEqual('123');
			expect(resp.redirect).not.toHaveBeenCalledTimes(1);
			expect(next).not.toHaveBeenCalled();
		});
	});

	test('Session::maybeRedirect() - does not redirect to login if route is api', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = 'api';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		return Promise.resolve(callback('123')).catch(reason => {
			expect(reason).toEqual('123');
			expect(resp.redirect).not.toHaveBeenCalledTimes(1);
			expect(next).not.toHaveBeenCalled();
		});
	});

	test('Session::maybeRedirect() - calls next on Error', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		const error = new Error('Oh snap');
		expect(callback(error)).toEqual(undefined);
		expect(resp.redirect).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith(error);
	});

	test('Session::maybeRedirect() - logon action', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		const reason = { isLoginAction: true, route: 'tos' };
		expect(callback(reason)).toEqual('redirected');
		expect(resp.redirect).toHaveBeenCalledTimes(1);
		expect(resp.redirect).toHaveBeenCalledWith('/tos');
		expect(next).not.toHaveBeenCalled();
	});

	test('Session::maybeRedirect() - logon action (preserve return url)', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/awesome-page',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		const reason = { isLoginAction: true, route: 'tos' };
		expect(callback(reason)).toEqual('redirected');
		expect(resp.redirect).toHaveBeenCalledTimes(1);
		expect(resp.redirect).toHaveBeenCalledWith(
			'/tos?return=%2Fawesome-page'
		);
		expect(next).not.toHaveBeenCalled();
	});

	test('Session::maybeRedirect() - logon action (nested route)', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = 'tos/fooboo';
		const start = new Date();

		const resp = {
			redirect: jest.fn(() => 'redirected'),
		};

		const req = {
			method: 'GET',
			originalUrl: '/tos/fooboo',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		const reason = { isLoginAction: true, route: 'tos' };
		expect(callback(reason)).toEqual(undefined);
		expect(resp.redirect).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});

	test('Session::maybeRedirect() - res.redirect failed', () => {
		const Session = require('../index');
		const session = new Session();

		const next = jest.fn();
		const basepath = '/';
		const scope = 'fooboo';
		const start = new Date();
		const er = new Error();

		const resp = {
			redirect: jest.fn(() => {
				throw er;
			}),
		};

		const req = {
			method: 'GET',
			originalUrl: '/tos/fooboo',
		};

		const callback = session.maybeRedirect(
			basepath,
			scope,
			start,
			req,
			resp,
			next
		);

		expect(callback()).toEqual(undefined);
		expect(resp.redirect).toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith(er);
	});

	test('Session::anonymousMiddleware() - calls next()', async () => {
		const Session = require('../index');
		const next = jest.fn();
		const session = new Session();
		// For now, this middleware doesn't do anything... when we add to it, we
		// should change these two frozen objects to allow mutation and validate
		// the middleware.
		const response = Object.freeze({});
		const request = Object.freeze({
			[SERVER_REF]: {
				async ping() {},
			},
		});

		expect(next).not.toHaveBeenCalled();
		await session.anonymousMiddleware(null, request, response, next);
		expect(next).toHaveBeenCalled();
	});
});
