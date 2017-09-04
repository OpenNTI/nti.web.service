/* eslint no-console:0 */
const request = require('supertest');
const mock = require('mock-require');
const DataserverInterFace = require('nti-lib-interfaces');

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

const mockLogger = {
	get () { return this; },
	attachToExpress () {},
	info () {},
	error () { console.error(...arguments); },
	warn () {},
	debug () {}
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

	beforeEach(() => {
		mock('../lib/logger', mockLogger);
		mock('nti-lib-interfaces', mockInterface);
		mock.reRequire('../lib/app-service');
	});

	afterEach(() => {
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
});
