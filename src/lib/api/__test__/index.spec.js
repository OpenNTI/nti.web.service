/*eslint-env jest*/
'use strict';

const {SERVER_REF} = require('../../constants');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe ('lib/api - index', () => {
	let logger;
	let expressApi;
	let expressMock;
	let endpoints;
	let getServiceDocument;
	let getObject;
	let doc;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		getObject = jest.fn(id => ({NTIID: id}));
		doc = {getObject};
		endpoints = jest.fn();
		getServiceDocument = jest.fn(() => Promise.resolve(doc));

		expressApi = Object.create({}, {
			param: {value: jest.fn()},
			use: {value: jest.fn()},
			get: {value: jest.fn()}
		});
		expressMock = jest.fn(() => expressApi);


		jest.doMock('../endpoints', () => endpoints);
		jest.doMock('express', () => expressMock);
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('registerEndPoints(): attaches endpoints to api/*', () => {
		const app = {use: jest.fn()};
		const register = require('../index');
		const config = {};

		register(app, config);

		expect(expressMock).toHaveBeenCalledTimes(1);
		const api = expressApi;
		expect(api).toBeTruthy();

		expect(app.use).toHaveBeenCalledTimes(1);
		expect(app.use).toHaveBeenCalledWith(expect.any(RegExp), expect.objectContaining({use: expect.any(Function)}));

		expect(endpoints).toHaveBeenCalledTimes(1);
		expect(endpoints).toHaveBeenCalledWith(api, config);

		expect(api.param).toHaveBeenCalledTimes(1);
		expect(api.param).toHaveBeenCalledWith('ntiid', expect.any(Function));

		expect(api.use).toHaveBeenCalledTimes(1);
		expect(api.use).toHaveBeenCalledWith(expect.any(Function));

		expect(api.ServiceMiddleWare).toEqual(expect.any(Function));
		expect(api.ServiceMiddleWare.length).toEqual(3);
	});


	test ('registerEndPoints(): ServiceMiddleWare', async () => {
		const app = {use: jest.fn()};
		const register = require('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config);

		expect(expressMock).toHaveBeenCalledTimes(1);
		const api = expressApi;
		expect(api.ServiceMiddleWare).toEqual(expect.any(Function));
		expect(api.ServiceMiddleWare.length).toEqual(3);

		const req = {[SERVER_REF]: dataserver};
		const res = {};
		const next = jest.fn();

		return Promise.resolve(api.ServiceMiddleWare(req, res, next))
			.then(result => {
				expect(result).toEqual(undefined);
				expect(req.ntiService).toEqual(doc);

				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith();
				next.mockClear();

				expect(getServiceDocument).toHaveBeenCalledTimes(1);
				expect(getServiceDocument).toHaveBeenCalledWith(req);
				getServiceDocument.mockClear();
			})

			.then(() => api.ServiceMiddleWare(req, res, next))
			.then(result => {
				expect(result).toEqual(undefined);
				expect(req.ntiService).toEqual(doc);

				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith();

				expect(getServiceDocument).not.toHaveBeenCalled();
			});
	});


	test ('registerEndPoints(): param filter should fetch object', () => {
		const app = {use: jest.fn()};
		const register = require('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expect(expressMock).toHaveBeenCalledTimes(1);
		const api = expressApi;

		const req = {ntiService: doc};
		const res = {};
		const id = 'some-object-id';


		expect(api.param).toHaveBeenCalledTimes(1);
		expect(api.param).toHaveBeenCalledWith('ntiid', expect.any(Function));
		const callback = api.param.mock.calls[0][1];
		expect(callback.length).toEqual(4);

		return new Promise((finish, err) => callback(req, res, (e) => e ? err(e) : finish(), id))
			.then(() => {
				expect(req.ntiidObject).toBeTruthy();
				expect(req.ntiidObject.NTIID).toEqual(id);
			});
	});


	test ('registerEndPoints(): error handler', () => {
		const app = {use: jest.fn()};
		const register = require('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expect(expressMock).toHaveBeenCalledTimes(1);
		const api = expressApi;

		const next = jest.fn();
		const req = {ntiService: doc};
		const res = {
			end: jest.fn(() => res),
			json: jest.fn(() => res),
			status: jest.fn(() => res)
		};

		expect(api.use).toHaveBeenCalledTimes(1);
		expect(api.use).toHaveBeenCalledWith(expect.any(Function));
		const callback = api.use.mock.calls[0][0];
		expect(callback.length).toEqual(4);

		const err = {
			stack: '',
			message: 'error-message'
		};

		callback(err, req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(expect.any(String),expect.any(String));

		expect(res.status).toHaveBeenCalledTimes(1);
		expect(res.status).toHaveBeenCalledWith(500);

		expect(res.json).toHaveBeenCalledTimes(1);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({stack: err.stack, message: err.message}));

		expect(res.end).toHaveBeenCalledTimes(1);
		expect(res.end).toHaveBeenCalledWith();
	});
});
