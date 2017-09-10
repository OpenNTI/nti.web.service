/*eslint-env jest*/
'use strict';


describe ('lib/api/endpoints/heath-check', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('registers _ops/ping', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};

		expect(() => register(api, {}, {})).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
	});


	test ('_ops/ping calls server.get(_ops/ping)', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};
		const server = {get: jest.fn(() => Promise.resolve())};

		expect(() => register(api, {}, server)).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
		const [, callback] = api.get.mock.calls[0];
		const res = {
			status: jest.fn()
		};

		return new Promise(finish => {
			res.end = finish;
			callback({}, res);
		})
			.then(() => {
				expect(res.status).toHaveBeenCalledTimes(1);
				expect(res.status).toHaveBeenCalledWith(200);
			});
	});


	test ('_ops/ping 503\'s if anything goes wrong.', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};
		const server = {get: jest.fn(() => Promise.reject())};

		expect(() => register(api, {}, server)).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
		const [, callback] = api.get.mock.calls[0];
		const res = {
			status: jest.fn()
		};

		return new Promise(finish => {
			res.end = finish;
			callback({}, res);
		})
			.then(() => {
				expect(res.status).toHaveBeenCalledTimes(1);
				expect(res.status).toHaveBeenCalledWith(503);
			});
	});
});
