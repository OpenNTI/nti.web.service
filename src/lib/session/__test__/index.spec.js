/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');
const {ServiceStash} = require('nti-lib-interfaces');

describe('lib/session', () => {
	let logger;
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
			get: sandbox.stub().returns(logger)
		};
		mock('../../logger', logger);
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('Session is a Class', () => {
		const Session = mock.reRequire('../index');

		Session.should.be.a('function');
		Session.prototype.should.not.equal(Object.prototype);
	});


	it ('Session constructor throws for no args', () => {
		const Session = mock.reRequire('../index');

		expect(() => new Session()).to.throw();
	});


	it ('Session constructor assigns server, and sessionSetup callback to self', () => {
		const Session = mock.reRequire('../index');
		const server = { config: {} };
		const sessionSetup = sandbox.stub();
		const session = new Session(server, sessionSetup);

		session.server.should.be.equal(server);
		session.config.should.be.equal(server.config);
		session.sessionSetup.should.be.equal(sessionSetup);
		sessionSetup.should.not.have.been.called;
	});


	it ('Session::getUser() - fulfills with the username of the active user (resolved from the Title of the User workspace on the service document)', () => {
		const workspace = {Title: 'testuser'};
		const Session = mock.reRequire('../index');
		const session = new Session({});
		const doc = {getUserWorkspace: sandbox.stub().returns(workspace)};
		sandbox.stub(session, 'getServiceDocument').returns(Promise.resolve(doc));

		const test = (context) => session.getUser(context)
			.then(name => {
				name.should.be.equal(workspace.Title);
				session.getServiceDocument.should.have.been.calledWithExactly(context);
				doc.getUserWorkspace.should.have.been.calledWithExactly();
			});

		return Promise.resolve()//sequential not parallel!
			.then(() => test())
			.then(() => test({}));
	});


	it ('Session::getUser() - error case - no user workspace', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});
		const doc = { getUserWorkspace: sandbox.stub() };
		sandbox.stub(session, 'getServiceDocument').returns(Promise.resolve(doc));

		const test = (context) => session.getUser(context)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(error => {
				expect(error).to.equal('No user workspace');
				session.getServiceDocument.should.have.been.calledWithExactly(context);
				doc.getUserWorkspace.should.have.been.calledWithExactly();
			});

		return Promise.resolve()//sequential not parallel!
			.then(() => test())
			.then(() => test({}));
	});


	it ('Session::getServiceDocument() - resolve the service document through a ping/handshake. Stash the logout-url.', () => {
		const Session = mock.reRequire('../index');
		const context = Object.create(null);
		const pong = {getLink: sandbox.stub().withArgs('logon.logout').returns('lala')};
		const ping = sandbox.stub().returns(Promise.resolve(pong));
		const doc = {setLogoutURL: sandbox.stub()};
		const getServiceDocument = sandbox.stub().returns(Promise.resolve(doc));
		const session = new Session({getServiceDocument, ping});

		return session.getServiceDocument(context)
			.then(resolved => {
				doc.should.equal(resolved);
				doc.setLogoutURL.should.have.been.calledOnce;
				doc.setLogoutURL.should.have.been.calledWithExactly('lala');

				ping.should.have.been.calledOnce;
				ping.should.have.been.calledWithExactly(context);
				getServiceDocument.should.have.been.calledOnce;
				getServiceDocument.should.have.been.calledWithExactly(context);

				pong.getLink.should.have.been.calledOnce;
				pong.getLink.should.have.been.calledWith('logon.logout');
			});
	});


	it ('Session::setupIntitalData() - get the service document, stash it on the context, call sessionSetup callback', () => {
		const Session = mock.reRequire('../index');
		const setup = sandbox.stub();
		const handler = {
			get: sandbox.stub(),
			set: sandbox.stub().withArgs(sinon.match.object, ServiceStash).returns(true)
		};
		const context = new Proxy({url: '...'}, handler);
		const service = {};
		const getServiceDocument = sandbox.stub().returns(Promise.resolve(service));
		const session = new Session({getServiceDocument}, setup);

		return session.setupIntitalData(context)
			.then(() => {
				getServiceDocument.should.have.been.calledOnce;
				getServiceDocument.should.have.been.calledWithExactly(context);

				setup.should.have.been.calledOnce;
				setup.should.have.been.calledWith(service);

				handler.set.should.have.been.calledOnce;
				handler.set.should.have.been.calledWith(sinon.match.object, ServiceStash, service);
			});
	});


	it ('Session::middleware() - gets the user, assigns it to the request context, and setups up intital data', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});
		sandbox.stub(session, 'getUser').callsFake(() => Promise.resolve('testuser'));
		sandbox.stub(session, 'setupIntitalData');
		//Continue the rejections...we will test this function by itself.
		sandbox.stub(session, 'maybeRedircect').callsFake(() => (e => Promise.reject(e)));

		const next = sandbox.stub();
		const basepath = '';

		const resp = {
			set: sandbox.stub(),
			redirect: sandbox.stub()
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: sandbox.stub()
			},

			emit: sandbox.stub(),
			on: sandbox.stub(),
			setMaxListeners: sandbox.stub(),
		};

		return session.middleware(basepath, req, resp, next)
			.then(() => {
				req.setMaxListeners.should.have.been.calledOnce;
				req.setMaxListeners.should.have.been.calledWith(1000);

				req.socket.setKeepAlive.should.have.been.calledOnce;
				req.socket.setKeepAlive.should.have.been.calledWith(true, 1000);

				session.getUser.should.have.been.calledOnce;
				session.getUser.should.have.been.calledWith(req);

				req.username.should.equal('testuser');

				session.setupIntitalData.should.have.been.calledOnce;
				session.setupIntitalData.should.have.been.calledWith(req);

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly();
			});
	});


	it ('Session::middleware() - error case: closed connection', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';

		const resp = {
			set: sandbox.stub(),
			redirect: sandbox.stub()
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: sandbox.stub()
			},

			emit: sandbox.stub(),
			on (event, cb) {
				if(event === 'close') {
					req['____forceClose'] = cb;
				}
			},
			setMaxListeners: sandbox.stub(),
		};

		sandbox.stub(session, 'getUser').callsFake(() => (req['____forceClose'](), Promise.resolve('testuser')));
		sandbox.stub(session, 'setupIntitalData');
		//Continue the rejections...we will test this function by itself.
		sandbox.stub(session, 'maybeRedircect').callsFake(() => (e => Promise.reject(e)));

		return session.middleware(basepath, req, resp, next)
			.then(() => {
				session.getUser.should.have.been.calledOnce;
				session.getUser.should.have.been.calledWith(req);

				req.username.should.equal('testuser');

				session.setupIntitalData.should.not.have.been.called;

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly('aborted');
			});
	});


	it ('Session::middleware() - error case: getUser rejects', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '';

		const resp = {
			set: sandbox.stub(),
			redirect: sandbox.stub()
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: sandbox.stub()
			},

			emit: sandbox.stub(),
			on: sandbox.stub(),
			setMaxListeners: sandbox.stub(),
		};

		sandbox.stub(session, 'getUser').callsFake(() => Promise.reject('Test'));
		sandbox.stub(session, 'setupIntitalData');
		//Continue the rejections...we will test this function by itself.
		sandbox.stub(session, 'maybeRedircect').callsFake(() => (e => Promise.reject(e)));

		return session.middleware(basepath, req, resp, next)
			.then(() => {
				session.getUser.should.have.been.calledOnce;
				session.getUser.should.have.been.calledWith(req);

				session.setupIntitalData.should.not.have.been.called;

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly('Test');
			});
	});


	it ('Session::middleware() - error case: setupIntitalData rejects', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '';

		const resp = {
			set: sandbox.stub(),
			redirect: sandbox.stub()
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: sandbox.stub()
			},

			emit: sandbox.stub(),
			on (event, cb) {
				if(event === 'close') {
					req['____forceClose'] = cb;
				}
			},
			setMaxListeners: sandbox.stub(),
		};

		sandbox.stub(session, 'getUser').callsFake(() => Promise.resolve('testuser'));
		sandbox.stub(session, 'setupIntitalData').callsFake(() => Promise.reject('Ooops'));
		//Continue the rejections...we will test this function by itself.
		sandbox.stub(session, 'maybeRedircect').callsFake(() => (e => Promise.reject(e)));

		return session.middleware(basepath, req, resp, next)
			.then(() => {
				session.getUser.should.have.been.calledOnce;
				session.getUser.should.have.been.calledWith(req);

				req.username.should.equal('testuser');

				session.setupIntitalData.should.have.been.calledOnce;
				session.setupIntitalData.should.have.been.calledWith(req);

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly('Ooops');
			});
	});


	it ('Session::middleware() - failing to set headers does not kill the response', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '';

		const resp = {
			set: sandbox.stub().throws('Shoot. :\'('),
			redirect: sandbox.stub()
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url',

			socket: {
				setKeepAlive: sandbox.stub()
			},

			emit: sandbox.stub(),
			on: sandbox.stub(),
			setMaxListeners: sandbox.stub(),
		};

		sandbox.stub(session, 'getUser').callsFake(() => Promise.resolve('testuser'));
		sandbox.stub(session, 'setupIntitalData');
		//Continue the rejections...we will test this function by itself.
		sandbox.stub(session, 'maybeRedircect').callsFake(() => (e => Promise.reject(e)));

		return session.middleware(basepath, req, resp, next)
			.then(() => {
				session.getUser.should.have.been.calledOnce;
				session.getUser.should.have.been.calledWith(req);

				req.username.should.equal('testuser');

				session.setupIntitalData.should.have.been.calledOnce;
				session.setupIntitalData.should.have.been.calledWith(req);

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly();
			});
	});


	it ('Session::maybeRedircect() - go to login', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url'
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		let ret;
		expect(() => ret = callback()).to.not.throw();
		ret.should.equal('redirected');
		resp.redirect.should.have.been.calledOnce;
		resp.redirect.should.have.been.calledWithExactly('/login/?return=original-url');
		next.should.not.have.been.called;
	});


	it ('Session::maybeRedircect() - drop on dead', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: 'original-url'
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		req.dead = true;
		let ret;
		expect(() => ret = callback()).to.not.throw();
		expect(ret).to.be.an('undefined');
		next.should.not.have.been.called;

	});


	it ('Session::maybeRedircect() - redirect to login without return param if at root', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/'
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		let ret;
		expect(() => ret = callback({statusCode: 401})).to.not.throw();
		ret.should.equal('redirected');
		resp.redirect.should.have.been.calledOnce;
		resp.redirect.should.have.been.calledWithExactly('/login/');
		next.should.not.have.been.called;

	});


	it ('Session::maybeRedircect() - does not redirect to login if route is login', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = 'login';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/'
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		return Promise.resolve(callback('123'))
			.catch(reason => {
				reason.should.equal('123');
				resp.redirect.should.not.have.been.calledOnce;
				next.should.not.have.been.called;
			});
	});


	it ('Session::maybeRedircect() - does not redirect to login if route is api', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = 'api';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/'
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		return Promise.resolve(callback('123'))
			.catch(reason => {
				reason.should.equal('123');
				resp.redirect.should.not.have.been.calledOnce;
				next.should.not.have.been.called;
			});
	});


	it ('Session::maybeRedircect() - calls next on Error', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		const error = new Error('Oh snap');
		expect(callback(error)).to.be.an('undefined');
		resp.redirect.should.not.have.been.called;
		next.should.have.been.calledOnce;
		next.should.have.been.calledWithExactly(error);
	});


	it ('Session::maybeRedircect() - logon action', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/',
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		const reason = {isLoginAction: true, route: 'tos'};
		expect(callback(reason)).to.be.equal('redirected');
		resp.redirect.should.have.been.calledOnce;
		resp.redirect.should.have.been.calledWithExactly('/tos');
		next.should.not.have.been.called;
	});


	it ('Session::maybeRedircect() - logon action (preserve return url)', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = '';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/awesome-page',
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		const reason = {isLoginAction: true, route: 'tos'};
		expect(callback(reason)).to.be.equal('redirected');
		resp.redirect.should.have.been.calledOnce;
		resp.redirect.should.have.been.calledWithExactly('/tos?return=%2Fawesome-page');
		next.should.not.have.been.called;
	});


	it ('Session::maybeRedircect() - logon action (nested route)', () => {
		const Session = mock.reRequire('../index');
		const session = new Session({});

		const next = sandbox.stub();
		const basepath = '/';
		const scope = 'tos/fooboo';
		const start = new Date();

		const resp = {
			redirect: sandbox.stub().returns('redirected')
		};

		const req = {
			method: 'GET',
			originalUrl: '/tos/fooboo',
		};


		const callback = session.maybeRedircect(basepath, scope, start, req, resp, next);

		const reason = {isLoginAction: true, route: 'tos'};
		expect(callback(reason)).to.be.an('undefined');
		resp.redirect.should.not.have.been.called;
		next.should.have.been.calledOnce;
		next.should.have.been.calledWithExactly();
	});


	it ('Session::anonymousMiddleware() - calls next() synchronously (no-ops for now)', () => {
		const Session = mock.reRequire('../index');
		const next = sandbox.stub();
		const handler = {
			get: sandbox.spy((s, prop) => s[prop])
		};
		const session = new Proxy(new Session({}), handler);

		next.should.not.have.been.called;
		expect(() => session.anonymousMiddleware(null, null, null, next)).to.not.throw();
		next.should.have.been.called;
		handler.get.should.have.been.calledOnce;
	});
});
