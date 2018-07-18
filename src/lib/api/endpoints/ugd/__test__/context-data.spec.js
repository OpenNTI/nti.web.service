/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe ('lib/api/endpoints/ugd/context-data', () => {
	let PageInfo;

	beforeEach(() => {
		jest.resetModules();

		PageInfo = require('@nti/lib-interfaces').Models.content.PageInfo;
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('registers ugd/context-data', () => {
		const {default: register} = require('../context-data');
		const api = {get: jest.fn()};

		expect(() => register(api, {}, {})).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
	});


	test ('fetches the container Html', () => {
		const {default: register} = require('../context-data');
		const api = {get: jest.fn()};

		expect(() => register(api, {}, {})).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
		const [, callback] = api.get.mock.calls[0];

		const pageInfo = new PageInfo(null, null, {});
		stub(pageInfo, 'getContent', () => Promise.resolve('html!'));

		const req = {
			ntiidObject: {
				getContainerID: jest.fn(() => 'my-container-id')
			},
			ntiService: {
				getObject: jest.fn(() => Promise.resolve(pageInfo))
			}
		};

		return new Promise((finish, error) => {
			const res = {
				json: finish
			};

			callback(req, res, error);
		})
			.then(json => {
				expect(json).toBeTruthy();
				expect(req.ntiidObject.getContainerID).toHaveBeenCalledTimes(1);
				expect(req.ntiService.getObject).toHaveBeenCalledTimes(1);
			});
	});


	test ('fetches the container - did not get pageInfo', () => {
		const {default: register} = require('../context-data');
		const api = {get: jest.fn()};

		expect(() => register(api, {}, {})).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
		const [, callback] = api.get.mock.calls[0];

		const req = {
			ntiidObject: {
				getContainerID: jest.fn(() => 'my-container-id')
			},
			ntiService: {
				getObject: jest.fn(() => Promise.resolve({}))
			}
		};

		return new Promise((finish, error) => {
			const res = {
				json: finish
			};

			callback(req, res, error);
		})
			.then(json => {
				expect(json).toBeTruthy();
				expect(req.ntiidObject.getContainerID).toHaveBeenCalledTimes(1);
				expect(req.ntiService.getObject).toHaveBeenCalledTimes(1);
			});
	});
});
