/* eslint no-console:0 */
const request = require('supertest');
const mock = require('mock-require');
const sinon = require('sinon');
const DataserverInterFace = require('nti-lib-interfaces');

const logger = require('../lib/logger');

const commonConfigs = {
	server: 'mock:/dataserver2/',
	'site-mappings': {
		undefined: {
			title: 'nextthought',
			name: 'moo'
		},
		default: {
			title: 'default',
			name: 'default'
		}
	}
};

const mockInterface = Object.assign({}, DataserverInterFace, {
	default (cfg) {
		return Object.assign({},
			DataserverInterFace.default(cfg),
			{
				interface: {
					getServiceDocument (req) {

						if(!req.headers.authentication) {
							return Promise.reject();
						}

						return Promise.resolve({
							getUserWorkspace () {
								return {
									Title: 'username'
								};
							},

							setLogoutURL () {}
						});
					},
					ping (name, req) {
						req[DataserverInterFace.SiteName] = 'default';

						if(!req.headers.authentication) {
							return Promise.reject({});
						}

						return Promise.resolve({
							getLink () {}
						});
					}
				}
			}
		);
	}
});

describe('Test End-to-End', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();

		sandbox.stub(logger, 'attachToExpress');
		sandbox.stub(logger, 'info');
		sandbox.stub(logger, 'error');
		sandbox.stub(logger, 'warn');
		sandbox.stub(logger, 'debug');

		mock('nti-lib-interfaces', mockInterface);
		mock.reRequire('../lib/app-service');
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('Route File redirects to Route Dir', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				package: '../../../example',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test')
			.expect(301)
			.expect(res => {
				res.headers.location.should.equal('/test/');
			});
	});


	it ('Anonymous access redirects to login', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				package: '../../../example',
				basepath: '/app/'
			}],
		});

		return request(getApp(config))
			.get('/app/')
			.expect(302)
			.expect(res => {
				res.headers.location.should.equal('/app/login/');
			});
	});


	it ('Authenticated access does not redirect', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				package: '../../../example',
				basepath: '/app/'
			}],
		});

		return request(getApp(config))
			.get('/app/')
			//This isn't testing the authentication itself, just the behavior of "authenticated" or not...
			.set('Authentication', 'foobar')
			.expect(200)
			.expect(res => {
				res.text.should.have.string('Page! at /app/');
			});
	});


	it ('Public access does not redirect', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../example',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/')
			.expect(200)
			.expect(res => {
				res.text.should.have.string('Page! at /test/');
			});
	});

	it ('Render A Page', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/')
			.expect(200)
			.expect(res => {
				res.text.should.have.string('Page! at /test/');
				//Variables injected:
				res.text.should.have.string('<title>nextthought</title>');
				res.text.should.not.have.string('"<[cfg:missing]>"');
				res.text.should.have.string('"MissingConfigValue"');
				//Rerooting should not effect absolute urls:
				res.text.should.have.string('<script src="https://cdnjs.cloudflare.com/ajax/libs/react/15.6.1/react.js"></script>');
				//Rerooted Urls:
				res.text.should.not.have.string('"/resources/images/favicon.ico"');
				res.text.should.have.string('"/test/resources/images/favicon.ico"');
				//Styles:
				res.text.should.not.have.string('"/resources/styles.css"');
				res.text.should.have.string('"/test/resources/styles.css?rel=foobar.js"');
				//Modules:
				res.text.should.not.have.string('<script src="/test/index.js" id="main-bundle" type="text/javascript"></script>');
				res.text.should.have.string('<script src="/test/foobar.js" id="main-bundle" type="text/javascript"></script>');

				//Check against double printing
				res.text.match(/\$AppConfig/g).length.should.equal(1);
			});
	});


	it ('Proper 404 for statics', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/resources/foo.missing')
			.expect(404);
	});


	it ('Proper 404 for non-app routes (controlled by app)', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/foo.missing')
			.expect(404);
	});


	it ('Proper 404 for non-app routes (controlled by app) v2', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/foo.explicit404')
			.expect(404);
	});


	it ('Proper 500 for app errors', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/foo.500')
			.expect(500)
			.expect(r => {
				r.text.should.have.string('App Error Page');
			});
	});


	it ('Service 500 for errors in app', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = Object.assign({}, commonConfigs, {
			apps: [{
				public: true,
				package: '../../../src/__test__/mock-app',
				basepath: '/test/'
			}],
		});

		return request(getApp(config))
			.get('/test/foo.throw')
			.expect(500)
			.expect(r => {
				logger.error.should.have.been.called;
				r.text.should.have.string('<title>Error</title>');
				r.text.should.have.string('<div id="error">An error occurred.</div>');
			});
	});
});
