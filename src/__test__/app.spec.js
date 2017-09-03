/* eslint no-console:0 */
const request = require('supertest');
const mock = require('mock-require');
const {ServiceStash} = require('nti-lib-interfaces');

mock('../lib/logger', {
	get () { return this; },
	attachToExpress () {},
	info () {},
	error () { console.error(...arguments); },
	warn () {},
	debug () {}
});

const mockAnonymousInterface = {
	ServiceStash,
	default () {
		return {
			interface: {
				getServiceDocument () {
					console.log('called');
				},
				ping () {
					console.log('called ping');
				}
			}
		};
	}
};

describe('Test End-to-End', () => {

	beforeEach(() => {
		mock('nti-lib-interfaces', mockAnonymousInterface);
	});

	afterEach(() => {
		mock.stopAll();
	});


	it ('Route File redirects to Route Dir', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = {
			server: 'mock:/dataserver2/',
			apps: [{
				package: '../../../example',
				basepath: '/test/'
			}],
		};

		return request(getApp(config))
			.get('/test')
			.expect(res => {
				res.headers.location.should.equal('/test/');
			})
			.expect(301);
	});


	it ('Anonymous access redirects to login', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = {
			server: 'mock:/dataserver2/',
			apps: [{
				package: '../../../example',
				basepath: '/app/'
			}],
		};

		return request(getApp(config))
			.get('/app/')
			.expect(res => {
				res.headers.location.should.equal('/app/login/');
			})
			.expect(302);
	});


	it ('Public access does not redirect', () => {
		const {getApp} = mock.reRequire('../worker');
		const config = {
			server: 'mock:/dataserver2/',
			apps: [{
				public: true,
				package: '../../../example',
				basepath: '/test/'
			}],
		};

		return request(getApp(config))
			.get('/test/')
			.expect(200)
			.expect(res => {
				res.text.should.have.string('Page! at /test/');
			});
	});
});
