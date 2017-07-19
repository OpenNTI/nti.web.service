/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');
const {SiteName, ServiceStash} = require('nti-lib-interfaces');

describe ('lib/config', () => {
	let logger;
	let sandbox;
	let yargs;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			attachToExpress: sandbox.stub(),
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};
		mock('../logger', logger);
		mock.reRequire('../site-mapping');

		yargs = {
			argv: {
				env: 'development',
				config: './mock/config.json'
			},
			alias () {return this;},
			usage () {return this;},
			help () {return this;},
			options () { return this; }
		};

		mock('yargs', yargs);
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('loadConfig(): missing config', () => {
		yargs.argv.config = void 0;
		mock('yargs', yargs);
		const {loadConfig} = mock.reRequire('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				e.should.equal('No config file specified');
			});
	});


	it ('loadConfig(): local config file (not found)', () => {
		yargs.argv.config = './mock/config.json';
		const readFileSync = sandbox.stub().throws(new Error('File Not Found'));
		mock('yargs', yargs);
		mock('fs', {readFileSync});
		const {loadConfig} = mock.reRequire('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				e.should.equal('Config Failed to load');
				readFileSync.should.have.been.calledThrice;
			});
	});


	it ('loadConfig(): file:// local config file (not found)', () => {
		yargs.argv.config = 'file:///mock/config.json';
		const readFileSync = sandbox.stub().throws(new Error('File Not Found'));
		mock('yargs', yargs);
		mock('fs', {readFileSync});
		const {loadConfig} = mock.reRequire('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				e.should.equal('Config Failed to load');
				readFileSync.should.have.been.calledThrice;
			});
	});


	it ('loadConfig(): local config file', () => {
		yargs.argv.config = './mock/config.json';
		const readFileSync = sandbox.stub().returns('{"mock": true}');
		mock('yargs', yargs);
		mock('fs', {readFileSync});

		const cfg = mock.reRequire('../config');
		sandbox.stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				cfg.config.should.have.been.calledOnce;
				cfg.config.should.have.been.calledWithExactly({mock: true});
			});
	});


	it ('loadConfig(): file:// local config file', () => {
		yargs.argv.config = 'file:///mock/config.json';
		const readFileSync = sandbox.stub().returns('{"mock": true}');
		mock('yargs', yargs);
		mock('fs', {readFileSync});

		const cfg = mock.reRequire('../config');
		sandbox.stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				cfg.config.should.have.been.calledOnce;
				cfg.config.should.have.been.calledWithExactly({mock: true});
			});
	});


	it ('loadConfig(): remote config file (bad)', () => {
		yargs.argv.config = 'http://lala/mock/config.json';
		mock('yargs', yargs);

		sandbox.stub(global, 'fetch').returns(Promise.resolve({ok: false, statusText: 'Not Found'}));

		const cfg = mock.reRequire('../config');
		sandbox.stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				cfg.config.should.not.have.been.called;
				expect(e).to.equal('Not Found');
			});
	});


	it ('loadConfig(): remote config file (good)', () => {
		yargs.argv.config = 'http://lala/mock/config.json';
		mock('yargs', yargs);
		const o = {};
		sandbox.stub(global, 'fetch').returns(Promise.resolve({ok: true, json: () => o}));

		const cfg = mock.reRequire('../config');
		sandbox.stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				cfg.config.should.have.been.calledOnce;
				cfg.config.should.have.been.calledWithExactly(o);
			});
	});


	it ('showFlags(): no flags', () => {
		const {showFlags} = mock.reRequire('../config');
		const o = {};

		expect(() => showFlags()).to.throw();
		expect(() => showFlags(o)).not.to.throw();

		logger.info.should.have.been.calledOnce;
		logger.info.should.have.been.calledWithExactly('No flags configured.');
	});


	it ('showFlags(): prints flags in the config', () => {
		const {showFlags} = mock.reRequire('../config');
		const o = {
			flags: {
				'flag1': true,
				'some.site.nextthought.com' : {
					'abc': true,
					'flag1': false
				}
			}
		};

		expect(() => showFlags(o)).not.to.throw();

		logger.info.should.have.been.calledThrice;
		logger.info.should.have.been.calledWithExactly('Resolved Flag: (Global) %s = %s', 'flag1', true);
		logger.info.should.have.been.calledWithExactly('Resolved Flag: (%s) %s = %s', 'some.site.nextthought.com', 'abc', true);
		logger.info.should.have.been.calledWithExactly('Resolved Flag: (%s) %s = %s', 'some.site.nextthought.com', 'flag1', false);

	});


	it ('config(): fails if no env specified', () => {
		yargs.argv.env = 'nope';
		mock('yargs', yargs);
		const {config} = mock.reRequire('../config');

		return config({})
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).to.equal('Missing Environment key');
			});
	});


	it ('config(): fails if no apps are configured.', () => {
		yargs.argv.env = 'test';
		mock('yargs', yargs);
		const {config} = mock.reRequire('../config');

		const env = {
			development: {},
			test: {}
		};

		return config(env)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).to.equal('No apps key in config.');
			});
	});


	it ('config(): fails a bad port is configured.', () => {
		const {config} = mock.reRequire('../config');

		const env = {
			development: {
				apps: [{}]
			},
		};

		return config(env)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).to.equal('Bad Port');
			});
	});


	it ('config(): normal case', () => {
		const {config} = mock.reRequire('../config');
		mock('foo/package.json', {name: 'foo.net', version: '123'});

		const env = {
			development: {
				port: 8081,
				apps: [
					{ package: 'foo' },
					{ package: 'bar' }
				]
			},
			'site-mappings': {}
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).to.be.an('object');
				c.apps[0].appId.should.equal('foo.net');
				c.apps[0].appName.should.equal('foo.net');
				c.apps[0].appVersion.should.equal('123');

				c.apps[1].appId.should.be.ok;
				c['site-mappings'].should.be.ok;

				logger.warn.should.have.been.calledWith('Could not fill in package values for app %s, because: %s', 'bar');
			});
	});


	it ('config(): override server', () => {
		Object.assign(yargs.argv, {
			'dataserver-host': 'lalaland',
			'dataserver-port': 1234
		});
		mock('yargs', yargs);

		const {config} = mock.reRequire('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).to.be.an('object');

				c.server.should.not.equal(env.development.server);
				c.server.should.equal('http://lalaland:1234/dataserver2/');
			});
	});


	it ('config(): override server (host only)', () => {
		Object.assign(yargs.argv, {
			'dataserver-host': 'lalaland',
		});
		mock('yargs', yargs);

		const {config} = mock.reRequire('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).to.be.an('object');

				c.server.should.not.equal(env.development.server);
				c.server.should.equal('http://lalaland:80012/dataserver2/');
			});
	});


	it ('config(): override server (port only)', () => {
		Object.assign(yargs.argv, {
			'dataserver-port': 1234
		});
		mock('yargs', yargs);

		const {config} = mock.reRequire('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).to.be.an('object');

				c.server.should.not.equal(env.development.server);
				c.server.should.equal('http://localhost:1234/dataserver2/');
			});
	});


	it ('config(): prints environment warning (only once)', () => {
		delete yargs.argv.env;
		mock('yargs', yargs);
		const {config} = mock.reRequire('../config');
		mock('bar/package.json', {});
		const env = {
			development: {
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(() => {
				logger.warn.should.have.been.calledWith('In default "development" mode. Consider --env "production" or setting NODE_ENV="production"');
				logger.warn.reset();
				return config(env);
			})
			.then(() => {
				logger.warn.should.not.have.been.called;
			});
	});


	it ('clientConfig(): filters server-side-only value of out config', () => {
		const {clientConfig} = mock.reRequire('../config');
		const context = {
			username: 'foobar',
			[SiteName]: 'some.site.nextthought.com',
			[ServiceStash]: {} //fake service
		};
		const config = {
			webpack: true,
			port: 1234,
			protocol: 'proxy',
			address: '0.0.0.0',
			apps: [
				{appId: 'abc', fluf: 'yes'},
				{appId: 'xyz', fluf: 'no'}
			],
			stuffAndThings: 'foobar',
			'site-mappings': {
				'some.site.nextthought.com': {
					name: 'test',
					title: 'Testing'
				}
			}
		};

		const res = clientConfig(config, context.username, 'abc', context);

		res.should.be.ok;
		res.html.should.be.a('string');
		res.config.siteName.should.equal('test');
		res.config.siteTitle.should.equal('Testing');
		res.config.username.should.equal(context.username);
		res.config.should.not.have.property('webpack');
		res.config.should.not.have.property('port');
		res.config.should.not.have.property('protocol');
		res.config.should.not.have.property('address');
		res.config.should.not.have.property('apps');
		res.config.should.not.have.property('site-mappings');
		res.config.nodeService.should.be.ok;
		res.config.nodeService.should.equal(context[ServiceStash]);
	});



	it ('clientConfig(): blows up if no service on context', () => {
		const {clientConfig} = mock.reRequire('../config');
		const context = {};
		const config = {};

		let out;
		expect(() => out = clientConfig(config, context.username, 'abc', context)).to.not.throw();

		return Promise.resolve(out.config.nodeService)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				e.should.be.an.instanceOf(Error);
				e.message.should.equal('No Service.');
			});
	});


	it ('nodeConfigAsClientConfig(): fakes clientConfig with full server-side config (for serverside rendering)', () => {
		const {nodeConfigAsClientConfig} = mock.reRequire('../config');
		const context = {
			username: 'foobar',
			[SiteName]: 'some.site.nextthought.com',
			[ServiceStash]: {} //fake service
		};
		const config = {
			webpack: true,
			port: 1234,
			protocol: 'proxy',
			address: '0.0.0.0',
			apps: [
				{appId: 'abc', fluf: 'yes'},
				{appId: 'xyz', fluf: 'no'}
			],
			stuffAndThings: 'foobar',
			'site-mappings': {
				'some.site.nextthought.com': {
					name: 'test',
					title: 'Testing'
				}
			}
		};

		const res = nodeConfigAsClientConfig(config, 'abc', context);

		res.should.be.ok;
		res.html.should.be.equal('');
		res.config.siteName.should.equal('test');
		res.config.username.should.equal(context.username);
		res.config.nodeService.should.be.ok;
		res.config.nodeService.should.equal(context[ServiceStash]);
	});


	it ('nodeConfigAsClientConfig(): blows up if no service on context', () => {
		const {nodeConfigAsClientConfig} = mock.reRequire('../config');
		const context = {};
		const config = {};

		let out;
		expect(() => out = nodeConfigAsClientConfig(config, 'abc', context)).to.not.throw();

		return Promise.resolve(out.config.nodeService)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				e.should.be.an.instanceOf(Error);
				e.message.should.equal('No Service.');
			});
	});
});
