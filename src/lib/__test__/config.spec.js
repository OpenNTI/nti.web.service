/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));


describe ('lib/config', () => {
	let SiteName, ServiceStash;
	let logger;
	let yargs;

	beforeEach(() => {
		jest.resetModules();
		global.fetch = () => {};
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

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

		jest.doMock('yargs', () => yargs);

		const iface = require('@nti/lib-interfaces');
		SiteName = iface.SiteName;
		ServiceStash = iface.ServiceStash;
	});


	afterEach(() => {
		delete global.fetch;
		jest.resetModules();
	});


	test ('loadConfig(): missing config', () => {
		yargs.argv.config = void 0;
		jest.doMock('yargs', () => yargs);
		const {loadConfig} = require('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e).toBe('No config file specified');
			});
	});


	test ('loadConfig(): local config file (not found)', () => {
		yargs.argv.config = './mock/config.json';
		const readFileSync = jest.fn(() => { throw new Error('File Not Found');});
		jest.doMock('yargs', () => yargs);
		jest.doMock('fs', () => ({readFileSync}));
		const {loadConfig} = require('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e).toBe('Config Failed to load');
				expect(readFileSync).toHaveBeenCalledTimes(3);
			});
	});


	test ('loadConfig(): file:// local config file (not found)', () => {
		yargs.argv.config = 'file:///mock/config.json';
		const readFileSync = jest.fn(() => { throw new Error('File Not Found');});
		jest.doMock('yargs', () => yargs);
		jest.doMock('fs', () => ({readFileSync}));
		const {loadConfig} = require('../config');

		return loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e).toBe('Config Failed to load');
				expect(readFileSync).toHaveBeenCalledTimes(3);
			});
	});


	test ('loadConfig(): local config file', () => {
		yargs.argv.config = './mock/config.json';
		const readFileSync = jest.fn(() => '{"mock": true}');
		jest.doMock('yargs', () => yargs);
		jest.doMock('fs', () => ({readFileSync}));

		const cfg = require('../config');
		stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				expect(cfg.config).toHaveBeenCalledTimes(1);
				expect(cfg.config).toHaveBeenCalledWith({mock: true});
			});
	});


	test ('loadConfig(): file:// local config file', () => {
		yargs.argv.config = 'file:///mock/config.json';
		const readFileSync = jest.fn(() => '{"mock": true}');
		jest.doMock('yargs', () => yargs);
		jest.doMock('fs', () => ({readFileSync}));

		const cfg = require('../config');
		stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				expect(cfg.config).toHaveBeenCalledTimes(1);
				expect(cfg.config).toHaveBeenCalledWith({mock: true});
			});
	});


	test ('loadConfig(): remote config file (bad)', () => {
		yargs.argv.config = 'http://lala/mock/config.json';
		jest.doMock('yargs', () => yargs);

		stub(global, 'fetch', () => Promise.resolve({ok: false, statusText: 'Not Found'}));

		const cfg = require('../config');
		stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(cfg.config).not.toHaveBeenCalled();
				expect(e).toBe('Not Found');
			});
	});


	test ('loadConfig(): remote config file (good)', () => {
		yargs.argv.config = 'http://lala/mock/config.json';
		jest.doMock('yargs', () => yargs);
		const o = {};
		stub(global, 'fetch', () => Promise.resolve({ok: true, json: () => o}));

		const cfg = require('../config');
		stub(cfg, 'config');

		return cfg.loadConfig()
			.then(() => {
				expect(cfg.config).toHaveBeenCalledTimes(1);
				expect(cfg.config).toHaveBeenCalledWith(o);
			});
	});


	test ('showFlags(): no flags', () => {
		const {showFlags} = require('../config');
		const o = {};

		expect(() => showFlags()).toThrow();
		expect(() => showFlags(o)).not.toThrow();

		expect(logger.info).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenCalledWith('No flags configured.');
	});


	test ('showFlags(): prints flags in the config', () => {
		const {showFlags} = require('../config');
		const o = {
			flags: {
				'flag1': true,
				'some.site.nextthought.com' : {
					'abc': true,
					'flag1': false
				}
			}
		};

		expect(() => showFlags(o)).not.toThrow();

		expect(logger.info).toHaveBeenCalledTimes(3);
		expect(logger.info).toHaveBeenCalledWith('Resolved Flag: (Global) %s = %s', 'flag1', true);
		expect(logger.info).toHaveBeenCalledWith('Resolved Flag: (%s) %s = %s', 'some.site.nextthought.com', 'abc', true);
		expect(logger.info).toHaveBeenCalledWith('Resolved Flag: (%s) %s = %s', 'some.site.nextthought.com', 'flag1', false);

	});


	test ('config(): fails if no env specified', () => {
		yargs.argv.env = 'nope';
		jest.doMock('yargs', () => yargs);
		const {config} = require('../config');

		return config({})
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).toBe('Missing Environment key');
			});
	});


	test ('config(): fails if no apps are configured.', () => {
		yargs.argv.env = 'test';
		jest.doMock('yargs', () => yargs);
		const {config} = require('../config');

		const env = {
			development: {},
			test: {}
		};

		return config(env)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).toBe('No apps key in config.');
			});
	});


	test ('config(): fails a bad port is configured.', () => {
		const {config} = require('../config');

		const env = {
			development: {
				apps: [{}]
			},
		};

		return config(env)
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(e => {
				expect(e.reason).toBe('Bad Port');
			});
	});


	test ('config(): normal case', () => {
		const {config} = require('../config');
		jest.doMock('foo/package.json', () => ({name: 'foo.net', version: '123'}), {virtual: true});

		const env = {
			development: {
				port: 8081,
				apps: [
					{ package: 'foo', basepath: '/foo/' },
					{ package: 'bar', basepath: '/bar/' },
					{ package: 'baz', basepath: '/foo/baz/' },
					{ package: 'buz', basepath: '/foo/buz/' },
					{ package: 'biz', basepath: '/foo/buz/' }
				]
			},
			'site-mappings': {}
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).toEqual(expect.any(Object));

				for (let x = 0; x < c.apps.length; x++ ) {
					expect(c.apps[x].appId).toBeTruthy();
					expect(c.apps[x].appId).toEqual(expect.any(String));
				}

				expect(c.apps.map(x => x.basepath)).toEqual([
					'/foo/baz/',
					'/foo/buz/',
					'/foo/buz/',
					'/bar/',
					'/foo/'
				]);

				const i = c.apps.findIndex(x => x.appId === 'foo.net');

				expect(i).not.toBe(-1);
				expect(c.apps[i].appId).toBe('foo.net');
				expect(c.apps[i].appName).toBe('foo.net');
				expect(c.apps[i].appVersion).toBe('123');

				expect(c['site-mappings']).toBeTruthy();

				expect(logger.warn).toHaveBeenCalledWith('Could not fill in package values for app %s, because: %s', 'bar', expect.anything());
			});
	});


	test ('config(): override server', () => {
		Object.assign(yargs.argv, {
			'dataserver-host': 'lalaland',
			'dataserver-port': 1234
		});
		jest.doMock('yargs', () => yargs);

		const {config} = require('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).toEqual(expect.any(Object));

				expect(c.server).not.toBe(env.development.server);
				expect(c.server).toBe('http://lalaland:1234/dataserver2/');
			});
	});


	test ('config(): override server (host only)', () => {
		Object.assign(yargs.argv, {
			'dataserver-host': 'lalaland',
		});
		jest.doMock('yargs', () => yargs);

		const {config} = require('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).toEqual(expect.any(Object));

				expect(c.server).not.toBe(env.development.server);
				expect(c.server).toBe('http://lalaland:80012/dataserver2/');
			});
	});


	test ('config(): override server (port only)', () => {
		Object.assign(yargs.argv, {
			'dataserver-port': 1234
		});
		jest.doMock('yargs', () => yargs);

		const {config} = require('../config');

		const env = {
			development: {
				server: 'http://localhost:80012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(c => {
				expect(c).toEqual(expect.any(Object));

				expect(c.server).not.toBe(env.development.server);
				expect(c.server).toBe('http://localhost:1234/dataserver2/');
			});
	});


	test ('config(): prints environment warning (only once)', () => {
		delete yargs.argv.env;
		jest.doMock('yargs', () => yargs);
		jest.doMock('bar/package.json', () => ({}), {virtual: true});
		const {config} = require('../config');
		const env = {
			development: {
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		return Promise.resolve(config(env))
			.then(() => {
				expect(logger.warn).toHaveBeenCalledWith('In default "development" mode. Consider --env "production" or setting NODE_ENV="production"');
				logger.warn.mockClear();
				return config(env);
			})
			.then(() => {
				expect(logger.warn).not.toHaveBeenCalled();
			});
	});


	test ('clientConfig(): filters server-side-only value of out config', () => {
		const {clientConfig} = require('../config');
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
			keys: {
				googleapi: {}
			},
			stuffAndThings: 'foobar',
			'site-mappings': {
				'some.site.nextthought.com': {
					name: 'test',
					title: 'Testing'
				}
			}
		};

		const res = clientConfig(config, context.username, 'abc', context);

		expect(res).toBeTruthy();
		expect(res.html).toEqual(expect.any(String));
		expect(res.config.siteName).toBe('test');
		expect(res.config.siteTitle).toBe('Testing');
		expect(res.config.username).toBe(context.username);
		expect(res.config).not.toHaveProperty('webpack');
		expect(res.config).not.toHaveProperty('port');
		expect(res.config).not.toHaveProperty('protocol');
		expect(res.config).not.toHaveProperty('address');
		expect(res.config).not.toHaveProperty('apps');
		expect(res.config).not.toHaveProperty('site-mappings');
		expect(res.config).not.toHaveProperty('keys');
		expect(res.config.nodeService).toBeTruthy();
		expect(res.config.nodeService).toBe(context[ServiceStash]);
	});


	test ('clientConfig(): blows up if no service on context', async () => {
		const {clientConfig} = require('../config');
		const context = {};
		const config = {};

		let out;
		expect(() => out = clientConfig(config, context.username, 'abc', context)).not.toThrow();

		try {
			await out.config.nodeService;
			throw new Error('Unexpected Promise fulfillment. It should have failed.');
		} catch(e) {
			expect(e).toEqual(expect.any(Error));
			expect(e.message).toBe('No Service.');
		}
	});


	test ('nodeConfigAsClientConfig(): fakes clientConfig with full server-side config (for serverside rendering)', () => {
		const {nodeConfigAsClientConfig} = require('../config');
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

		expect(res).toBeTruthy();
		expect(res.html).toBe('');
		expect(res.config.siteName).toBe('test');
		expect(res.config.username).toBe(context.username);
		expect(res.config.nodeService).toBeTruthy();
		expect(res.config.nodeService).toBe(context[ServiceStash]);
	});


	test ('nodeConfigAsClientConfig(): blows up if no service on context', async () => {
		const {nodeConfigAsClientConfig} = require('../config');
		const context = {};
		const config = {};

		let out;
		expect(() => out = nodeConfigAsClientConfig(config, 'abc', context)).not.toThrow();

		try {
			await out.config.nodeService;
			throw new Error('Unexpected Promise fulfillment. It should have failed.');
		}
		catch(e) {
			expect(e).toEqual(expect.any(Error));
			expect(e.message).toBe('No Service.');
		}
	});
});
