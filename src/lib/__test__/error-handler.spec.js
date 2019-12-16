/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));


describe('lib/error-handler (middleware)', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		jest.doMock('uuid/v4', () => () => 'some-guid');
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('expected exported api', () => {
		const use = jest.fn();
		const {middleware, setupErrorHandler} = require('../error-handler');

		expect(setupErrorHandler).toEqual(expect.any(Function));

		setupErrorHandler({use}, {});

		expect(use).toHaveBeenCalledWith(middleware);
	});


	test ('middleware is a function with 4 arguments (express error handler)', () => {
		const {middleware: fn} = require('../error-handler');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(4);
	});


	test ('the error middleware function does not call next()', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		expect(() => fn(new Error(), {}, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(next).not.toHaveBeenCalled();
	});


	test ('the error middleware function: error implements toJSON...', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		const json = {abc: '123'};
		const err = {toJSON: () => json};
		jest.spyOn(err, 'toJSON');

		expect(() => fn(err, {}, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(err.toJSON).toHaveBeenCalledOnce;
		expect(res.status).toHaveBeenCalledOnce;
		expect(res.status).toHaveBeenCalledWith(500);
	});


	test ('the error middleware function: error thats a JSO', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		const err = {abc: '123'};

		expect(() => fn(err, {}, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.status).toHaveBeenCalledOnce;
		expect(res.status).toHaveBeenCalledWith(500);
	});


	test ('the error middleware function: handles aborted', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		expect(() => fn('aborted', {}, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.status).toHaveBeenCalledWith(204);
		expect(res.end).toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
	});


	test ('the error middleware function: handles missing errors', () => {
		const handler = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			render () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'render');
		jest.spyOn(res, 'status');

		expect(() => handler.middleware(null, {}, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.render).toHaveBeenCalledWith('error', { contact: '', err: 'Unknown Error', errorid: 'some-guid', message: ''});
		expect(res.end).not.toHaveBeenCalled();
	});


	test ('the error middleware function: handles 503', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		expect(() => fn({statusCode: 503, message: '__'}, null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.status).toHaveBeenCalledWith(503);
		expect(res.send).toHaveBeenCalledWith('__');
		expect(res.end).not.toHaveBeenCalled();
	});


	test ('the error middleware function: handles implicit 503', () => {
		const {middleware: fn} = require('../error-handler');
		const next = jest.fn();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		jest.spyOn(res, 'end');
		jest.spyOn(res, 'send');
		jest.spyOn(res, 'status');

		expect(() => fn({message: 'Service Unavailable'}, null, res, next)).not.toThrow(); //and .toEqual(undefined)

		expect(res.status).toHaveBeenCalledWith(503);
		expect(res.send).toHaveBeenCalledWith('Service Unavailable');
		expect(res.end).not.toHaveBeenCalled();
	});
});
