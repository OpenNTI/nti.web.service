/* eslint-env jest */
'use strict';
const request = require('supertest');
const DataserverInterFace = require('@nti/lib-interfaces');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

const commonConfigs = {
	server: 'mock:/dataserver2/',
};

const interfaceImplementation = {
	async getServiceDocument (req) {

					if(!req.headers.authentication) {
			throw Object.assign(new Error('Not Authenticated'), {statusCode: 401});
					}

					const username = req.headers.authentication;

		return {
						getUserWorkspace () {
							return {
								Title: username
							};
						},

						setLogoutURL () {},

						getAppUsername () { return username; },

			async getAppUser () {
							const user = {};

							if (username === 'tos') {
								user.acceptTermsOfService = true;
							}

				return user;
						}
		};
				},
	async ping (name, req) {
					req.pong = {Site: 'default'};

					if(!req.headers.authentication) {
			throw Object.assign(new Error('Not Authenticated'), {statusCode: 401});
					}

		return {
						getLink () {}
		};
				},
				async get (uri) {
					if (uri === 'SiteBrand') {
						return {
							'brand_name': 'yo-brand'
						};
					}
				}
};

const mockInterface = {
	...DataserverInterFace,
	default (cfg) {
		return {
			...DataserverInterFace.default(cfg),
			interface: interfaceImplementation,
		};
	}
};

describe('Test End-to-End', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../lib/logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		jest.doMock('@nti/lib-interfaces', () => mockInterface);
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('Injections', async () => {
		const {getApp} = require('../worker');
		const config = {
			...commonConfigs,
			apps: [{
				package: '../../example',
				basepath: '/test/',
				public: true
			}],

			templateInjections: {
				head: {
					start: {content: 'A'},
					end: {content: 'B'},
				},
				body: {
					start: {content: 'C'}
				}
			}
		};

		const res = await request(await getApp(config))
			.get('/test/');

		expect(res.text).toMatch(/<head[^>]*>A/);
		expect(res.text).toMatch(/B<\/head>/);
		expect(res.text).toMatch(/<body[^>]*>C/);
	});

	test ('Route File redirects to Route Dir', async () => {
		const {getApp} = require('../worker');
		const config = {
			...commonConfigs,
			apps: [{
				package: '../../example',
				basepath: '/test/'
			}],
		};

		const res = await request(await getApp(config))
			.get('/test')
			.expect(301);

		expect(res.headers.location).toEqual('/test/');
	});


	test ('Anonymous access redirects to login', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			package: '../../example',
			basepath: '/app/'
		}],};

		const res = await request(await getApp(config))
			.get('/app/')
			.expect(302);

		expect(res.headers.location).toEqual('/app/login/');
	});


	test ('Authenticated access does not redirect', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			package: '../../example',
			basepath: '/app/'
		}],};

		const res = await request(await getApp(config))
			.get('/app/')
			//This isn't testing the authentication itself, just the behavior of "authenticated" or not...
			.set('Authentication', 'foobar')
			.expect(200);

		expect(res.text).toEqual(expect.stringContaining('Page! at /app/'));
		expect(res.text).toEqual(expect.stringContaining('branding":{"brand_name":"yo-brand"}'));

	});


	test ('Public access does not redirect', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: '../../example',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/')
			.expect(200);

		expect(res.text).toEqual(expect.stringContaining('Page! at /test/'));
		expect(res.text).toEqual(expect.stringContaining('branding":{"brand_name":"yo-brand"}'));

	});


	test ('Render A Page', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/')
			.expect(200);

		expect(res.text).toEqual(expect.stringContaining('Page! at /test/'));
		//Variables injected:
		expect(res.text).toEqual(expect.stringContaining('<title>yo-brand</title>'));
		expect(res.text).not.toEqual(expect.stringContaining('"<[cfg:missing]>"'));
		expect(res.text).toEqual(expect.stringContaining('"MissingConfigValue[missing]"'));
		//Rerooting should not effect absolute urls:
		expect(res.text).toEqual(expect.stringContaining('<script src="https://cdnjs.cloudflare.com/ajax/libs/react/15.6.1/react.js"></script>'));
		//Rerooted Urls:
		expect(res.text).not.toEqual(expect.stringContaining('"/resources/images/favicon.ico"'));
		expect(res.text).toEqual(expect.stringContaining('"/test/resources/images/favicon.ico"'));

		//Check against double printing
		expect(res.text.match(/\$AppConfig/g).length).toEqual(1);

	});


	test ('Page Renders have cach-busting headers and no etag', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/')
			.expect(200);

		expect(res.headers).not.toHaveProperty('etag');
		expect(res.headers).toHaveProperty('cache-control', 'no-cache, no-store, must-revalidate, max-age=0');
		expect(res.headers).toHaveProperty('expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
		expect(res.headers).toHaveProperty('pragma', 'no-cache');

	});


	test ('Statics have cacheable headers', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/existing.asset')
			.expect(200);

		expect(res.headers).not.toHaveProperty('expires');
		expect(res.headers).not.toHaveProperty('pragma');

		expect(res.headers).toHaveProperty('etag');
		expect(res.headers).toHaveProperty('last-modified');
		expect(res.headers).toHaveProperty('cache-control', 'public, max-age=3600');
	});


	test ('Proper 404 for statics', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		return request(await getApp(config))
			.get('/test/resources/foo.missing')
			.expect(404);
	});


	test ('Proper 404 for non-app routes (controlled by app)', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		return request(await getApp(config))
			.get('/test/foo.missing')
			.expect(404);
	});


	test ('Proper 404 for non-app routes (controlled by app) v2', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		return request(await getApp(config))
			.get('/test/foo.explicit404')
			.expect(404);
	});


	test ('Proper 500 for app errors', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/foo.500')
			.expect(500);

		expect(res.text).toEqual(expect.stringContaining('App Error Page'));
	});


	test ('Service 500 for errors in app', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			public: true,
			package: './mock-app',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/foo.throw')
			.expect(500);

		expect(logger.error).toHaveBeenCalled();
		expect(res.text).toEqual(expect.stringContaining('<title>Error</title>'));
		expect(res.text).toEqual(expect.stringContaining('<div id="error">An error occurred.</div>'));
	});


	test ('Test Hooks: Session', async () => {
		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			package: './mock-app-with-hooks',
			basepath: '/test/'
		}],};

		const res = await request(await getApp(config))
			.get('/test/')
			.set('Authentication', 'tos')
			.expect(302);

		expect(res.headers.location).toEqual('/test/onboarding/tos');
	});


	defineRedirectTests('');
	defineRedirectTests('foo');
	defineRedirectTests('tos');


	test ('Test Hooks: Invalid Hook', async (done) => {
		const Logger = logger.get('SessionManager');
		const Session = require('../lib/session');

		stub(Logger, 'error');
		jest.spyOn(Session.prototype, 'middleware');


		const {getApp} = require('../worker');
		const config = { ...commonConfigs, apps: [{
			package: './mock-app-with-hooks',
			basepath: '/test/'
		}],};

		request(await getApp(config))
			.get('/test/?breakme=now')
			.set('Cookie', 'language=en')
			.end((e) => {
				setTimeout(() => {
					expect(Session.prototype.middleware).toHaveBeenCalled();
					expect(Logger.error).toHaveBeenCalledWith(
						'Headers have already been sent. did next() get called after a redirect()/send()/end()? %s %s',
						expect.any(String),
						expect.any(String)
					);
					done(e);
				}, 100);
			});
	});


	function defineRedirectTests (user) {

		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=aa')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/');
		});


		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=library/courses/available/invitations/accept/token')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/catalog/code/token');
		});


		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=/app/library/courses/available/NTI-CourseInfo-iLed_iLed_001/...')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/catalog/item/NTI-CourseInfo-iLed_iLed_001/...');
		});


		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=library/availablecourses/IUB0YWc6bmV4dHRob3VnaHQuY29tLDIwMTEtMTA6TlRJLUNvdXJzZUluZm8tU3ByaW5nMjAxNV9MU1REXzExNTM/redeem/code')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/catalog/redeem/NTI-CourseInfo-Spring2015_LSTD_1153/code');
		});


		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=/app/id/unknown-OID-0x021cae18:5573657273:V0wWNR9EBJd')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/object/unknown-OID-0x021cae18%3A5573657273%3AV0wWNR9EBJd');
		});


		test (`Test Hooks: Redirects (${user ? 'Authenticated' : 'Anonymous'})`, async () => {
			const {getApp} = require('../worker');
			const config = { ...commonConfigs, apps: [{
				package: './mock-app-with-hooks',
				basepath: '/test/'
			}],};

			const res = await request(await getApp(config))
				.get('/test/?q=object/ntiid/tag:nextthought.com,2011-10:unknown-OID-0x021cae18:5573657273:V0wWNR9EBJd')
				.set('Authentication', user)
				.expect(302);

			expect(res.headers.location).toEqual('/test/object/unknown-OID-0x021cae18%3A5573657273%3AV0wWNR9EBJd');
		});
	}

});
