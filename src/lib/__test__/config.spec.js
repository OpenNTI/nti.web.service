/*eslint-env jest*/
'use strict';
const {SERVER_REF} = require('../constants');
const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));


describe ('lib/config', () => {
	let ServiceStash;
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


	test ('config(): normal case', async () => {
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
			}
		};

		const c = await Promise.resolve(config(env));
		expect(c).toEqual(expect.any(Object));
		for (let x = 0; x < c.apps.length; x++) {
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
		expect(logger.warn).toHaveBeenCalledWith('Could not fill in package values for app %s, because: %s', 'bar', expect.anything());
	});


	test ('config(): override server', async () => {
		Object.assign(yargs.argv, {
			'dataserver': 'http://lalaland:1234/'
		});
		jest.doMock('yargs', () => yargs);

		const {config} = require('../config');

		const env = {
			development: {
				server: 'http://localhost:8012/dataserver2/',
				port: 8081,
				apps: [{ package: 'bar' }]
			},
		};

		const c = await Promise.resolve(config(env));
		expect(c).toEqual(expect.any(Object));
		expect(c.server).toBe('http://lalaland:1234/');
	});


	test ('config(): prints environment warning (only once)', async () => {
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

		await Promise.resolve(config(env));
		expect(logger.warn).toHaveBeenCalledWith('In default "development" mode. Consider --env "production" or setting NODE_ENV="production"');
		logger.warn.mockClear();
		config(env);
		expect(logger.warn).not.toHaveBeenCalled();
	});


	test ('clientConfig(): filters server-side-only value of out config', async () => {
		const {clientConfig} = require('../config');
		const context = {
			username: 'foobar',
			pong: {Site: 'some.site.nextthought.com'},
			protocol: 'https',
			headers: {
				host: 'some.site.nextthought.com:8080',
			},
			[ServiceStash]: {}, //fake service
			[SERVER_REF]: {
				get: (rel) => (rel === 'SiteBrand') ? {'brand_name': 'Testing'} : void 0
			}
		};
		const config = {
			server: 'http://some-private-host:1234/dataserver2/',
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
		};

		const res = await clientConfig(config, context.username, 'abc', context);

		expect(res).toBeTruthy();
		expect(res.html).toEqual(expect.any(String));
		expect(res.config.server).toBe('/dataserver2/');
		expect(res.config.siteName).toBe('some.site.nextthought.com');
		expect(res.config.siteTitle).toBe('Testing');
		expect(res.config.username).toBe(context.username);
		expect(res.config).not.toHaveProperty('webpack');
		expect(res.config).not.toHaveProperty('port');
		expect(res.config).not.toHaveProperty('protocol');
		expect(res.config).not.toHaveProperty('address');
		expect(res.config).not.toHaveProperty('apps');
		expect(res.config).not.toHaveProperty('keys');
		expect(res.config.nodeService).toBeTruthy();
		expect(res.config.nodeService).toBe(context[ServiceStash]);
	});


	test ('clientConfig(): blows up if no service on context', async () => {
		const {clientConfig} = require('../config');
		const context = {};
		const config = {server: '/dataserver2/'};

		const out = await clientConfig(config, context.username, 'abc', context);

		try {
			await out.config.nodeService;
			throw new Error('Unexpected Promise fulfillment. It should have failed.');
		} catch(e) {
			expect(e).toEqual(expect.any(Error));
			expect(e.message).toBe('No Service.');
		}
	});

	describe('clientConfig(): SiteBranding', () => {
		const getConfig = () => {
			return {
				server: 'http://some-private-host:1234/dataserver2/',
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
			};
		};

		const getContext = (siteBrand) => {
			const get = jest.fn((url) => {
				if (url === 'SiteBrand') {
					if (!siteBrand) {
						throw new Error('Unable to load SiteBrand');
					} else {
						return siteBrand;
					}
				}
			});

			return {
				username: 'mock.user',
				pong: {Site: 'mock.site.nextthought.com'},
				[SERVER_REF]: {
					get
				}
			};
		};


		test('adds site branding to the config', async () => {
			const {clientConfig} = require('../config');
			const siteBrand = {};

			const context = getContext(siteBrand);
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.branding).toBe(siteBrand);
			expect(context[SERVER_REF].get).toHaveBeenCalledWith('SiteBrand', context);
			expect(context[SERVER_REF].get).toHaveBeenCalledTimes(1);
		});

		test('site branding fails', async () => {
			const {clientConfig} = require('../config');

			const context = getContext();
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.branding).toBeNull();
			expect(context[SERVER_REF].get).toHaveBeenCalledWith('SiteBrand', context);
			expect(context[SERVER_REF].get).toHaveBeenCalledTimes(1);
		});

		test('adds favicon to the config (with cache bust)', async () => {
			const {clientConfig} = require('../config');
			const siteBrand = {
				assets: {
					logo: {href: 'path/to/logo.png'},
					favicon: {href: '/path/to/favicon.ico', 'Last Modified': 1573493123.045}
				}
			};

			const context = getContext(siteBrand);
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.favicon).toBe('/path/to/favicon.ico?v=1573493123.045');
		});

		test('adds favicon to the config (with no cache bust)', async () => {
			const {clientConfig} = require('../config');
			const siteBrand = {
				assets: {
					logo: {href: 'path/to/logo.png'},
					favicon: {href: '/path/to/favicon.ico'}
				}
			};

			const context = getContext(siteBrand);
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.favicon).toBe('/path/to/favicon.ico');
		});

		test('adds default favicon (no favicon asset)', async () => {
			const {clientConfig} = require('../config');
			const siteBrand = {
				assets: {logo: {href: '/path/to/logo.png'}}
			};

			const context = getContext(siteBrand);
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.favicon).toBe('/favicon.ico');
		});

		test('adds default favicon (no assets)', async () => {
			const {clientConfig} = require('../config');
			const siteBrand = {};

			const context = getContext(siteBrand);
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.favicon).toBe('/favicon.ico');
		});

		test('adds default favicon (no SiteBrand)', async () => {
			const {clientConfig} = require('../config');

			const context = getContext();
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.favicon).toBe('/favicon.ico');
		});

		test('sets siteTitle', async () => {
			const {clientConfig} = require('../config');

			const brandName = 'Test Brand Name';
			const context = getContext({'brand_name': brandName});
			const config = getConfig();

			const out = await clientConfig(config, context.username, 'abc', context);

			expect(out.config.siteTitle).toBe(brandName);
		});
	});


	test ('nodeConfigAsClientConfig(): fakes clientConfig with full server-side config (for serverside rendering)', () => {
		const {nodeConfigAsClientConfig} = require('../config');
		const context = {
			username: 'foobar',
			pong: {
				Site: 'some.site.nextthought.com',
			},
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
		};

		const res = nodeConfigAsClientConfig(config, 'abc', context);

		expect(res).toBeTruthy();
		expect(res.html).toBe('');
		expect(res.config.siteName).toBe('some.site.nextthought.com');
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
