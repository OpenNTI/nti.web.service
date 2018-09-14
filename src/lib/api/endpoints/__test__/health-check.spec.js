/*eslint-env jest*/
'use strict';

const PING_THROUGH = /^\/_ops\/ping-through/;
const PING = /^\/_ops\/ping/;

const REQ = (a, b) => a.source === b.source;
const getCallback = (calls, RE) => (calls.find(x => REQ(x[0], RE)) || [])[1];

describe ('lib/api/endpoints/heath-check', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('registers _ops/ping(s)', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};

		expect(() => register(api, {}, {})).not.toThrow();
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
	});


	test ('_ops/ping-through calls server.get(_ops/ping)', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};
		const server = {get: jest.fn(() => Promise.resolve())};

		expect(() => register(api, {}, server)).not.toThrow();
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));

		const callback = getCallback(api.get.mock.calls, PING_THROUGH);
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


	test ('_ops/ping-through 503\'s if anything goes wrong.', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};
		const server = {get: jest.fn(() => Promise.reject())};

		expect(() => register(api, {}, server)).not.toThrow();
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
		const callback = getCallback(api.get.mock.calls, PING_THROUGH);
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


	test ('_ops/ping responds with 200.', () => {
		const {default: register} = require('../health-check');
		const api = {get: jest.fn()};
		const server = {get: jest.fn(() => Promise.reject())};

		expect(() => register(api, {}, server)).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(2);
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
		const callback = getCallback(api.get.mock.calls, PING);
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
});
