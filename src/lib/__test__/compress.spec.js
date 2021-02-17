/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/compress (middleware)', () => {
	beforeEach(() => {
		jest.resetModules();
		const logger = require('../logger');
		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('attachToExpress adds two middleware, one to serve precompressed gz files, and one to fallback to dynamicly compress.', () => {
		const compression = {};
		const precompressed = {};
		const use = jest.fn();
		const compressionFactory = jest.fn(() => compression);

		jest.doMock('compression', () => compressionFactory);
		const o = require('../compress');
		stub(o, 'precompressed', () => precompressed);

		o.attachToExpress({ use });

		expect(compressionFactory).toHaveBeenCalledTimes(1);

		expect(use).toHaveBeenCalledTimes(2);
		expect(use).toHaveBeenCalledWith(precompressed);
		expect(use).toHaveBeenCalledWith(compression);
	});

	test('compression filter function returns false when the request has x-no-compression header', () => {
		const filter = jest.fn(() => true);
		jest.doMock('compression', () => ({ filter }));
		const { compressionFilter } = require('../compress');

		const req = {
			url: '/',
			get: jest.fn(x => x === 'x-no-compression' || void 0),
		};

		expect(compressionFilter(req)).toBe(false);
		expect(filter).not.toHaveBeenCalled();
	});

	test('compression filter function returns false when the request url ends in .gz', () => {
		const filter = jest.fn(() => true);
		jest.doMock('compression', () => ({ filter }));
		const { compressionFilter } = require('../compress');

		const req = { url: '/index.js.gz', get: jest.fn() };

		expect(compressionFilter(req)).toBe(false);
		expect(filter).not.toHaveBeenCalled();
	});

	test('compression filter function calls fallback filter when url does not end in .gz nor have header-block', () => {
		const filter = jest.fn(() => true);
		jest.doMock('compression', () => ({ filter }));
		const { compressionFilter } = require('../compress');

		const req = { url: '/index.js', get: jest.fn() };

		expect(compressionFilter(req)).toBe(true);
		expect(filter).toHaveBeenCalled();
	});

	test('precompressed() bypass: requests that have x-no-compression header', () => {
		const filter = jest.fn(() => true);
		const next = jest.fn();
		const access = jest.fn();
		jest.doMock('compression', () => ({ filter }));
		jest.doMock('fs', () => ({ access }));
		const { precompressed } = require('../compress');

		const middleware = precompressed('/');
		expect(middleware).toEqual(expect.any(Function));

		const req = Object.freeze({
			url: '/foobar',
			get: jest.fn(
				x =>
					x === 'x-no-compression' ||
					(x === 'accept-encoding' ? 'plain,gzip' : void x)
			),
		});

		middleware(req, null, next);

		expect(next).toHaveBeenCalled();
		expect(access).not.toHaveBeenCalled();
	});

	test('precompressed() bypass: requests that do not declare support', () => {
		const filter = jest.fn(() => true);
		const next = jest.fn();
		const access = jest.fn();
		jest.doMock('compression', () => ({ filter }));
		jest.doMock('fs', () => ({ access }));
		const { precompressed } = require('../compress');

		const middleware = precompressed('/');
		expect(middleware).toEqual(expect.any(Function));

		const req = Object.freeze({
			url: '/foobar',
			get: jest.fn(x => (x === 'accept-encoding' ? '' : void x)),
		});

		middleware(req, null, next);

		expect(next).toHaveBeenCalled();
		expect(access).not.toHaveBeenCalled();
	});

	test('precompressed() bypass: file access errors', () => {
		const filter = jest.fn(() => true);
		const next = jest.fn();
		const access = jest.fn();
		jest.doMock('compression', () => ({ filter }));
		jest.doMock('fs', () => ({ access }));
		const { precompressed } = require('../compress');

		const middleware = precompressed('/');
		expect(middleware).toEqual(expect.any(Function));

		const res = {
			set: jest.fn(),
		};

		const req = Object.freeze({
			url: '/foobar',
			get: jest.fn(x =>
				x === 'accept-encoding' ? 'plain,gzip' : void x
			),
		});

		middleware(req, res, next);

		expect(next).not.toHaveBeenCalled();

		expect(access).toHaveBeenCalled();
		const callback = access.mock.calls[0][2];
		expect(callback).toEqual(expect.any(Function));

		//manually callback the fs.access callback... with an error
		expect(() => callback(new Error('oops'))).not.toThrow();

		//By getting here, the 'req' object had not been modified (the freeze would make modifications to throw, and fail the test)
		expect(res.set).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalled();
	});

	test('precompressed(): switches the static asset to the .gz and adds changes encodeing', () => {
		const filter = jest.fn(() => true);
		const next = jest.fn();
		const access = jest.fn();
		jest.doMock('compression', () => ({ filter }));
		jest.doMock('fs', () => ({ access }));
		const { precompressed } = require('../compress');

		const middleware = precompressed('/');
		expect(middleware).toEqual(expect.any(Function));

		const req = {
			url: '/foobar',
			get: jest.fn(x =>
				x === 'accept-encoding' ? 'plain,gzip' : void x
			),
		};

		const res = {
			set: jest.fn(),
		};

		middleware(req, res, next);

		expect(next).not.toHaveBeenCalled();

		expect(access).toHaveBeenCalled();
		const callback = access.mock.calls[0][2];
		expect(callback).toEqual(expect.any(Function));

		//manually callback the fs.access callback... with no error
		expect(() => callback()).not.toThrow();

		expect(req.url).toEqual(expect.stringMatching(/\.gz$/i));
		expect(res.set).toHaveBeenCalledTimes(1);
		expect(res.set).toHaveBeenCalledWith('Content-Encoding', 'gzip');
		expect(next).toHaveBeenCalled();
	});

	test('precompressed(): switches the static asset to the .gz and adds changes encodeing, enforcing known Content-Types', () => {
		const filter = jest.fn(() => true);
		const next = jest.fn();
		const access = jest.fn();
		jest.doMock('compression', () => ({ filter }));
		jest.doMock('fs', () => ({ access }));
		const { precompressed } = require('../compress');

		const middleware = precompressed('/');
		expect(middleware).toEqual(expect.any(Function));

		const req = {
			url: '/foobar.html',
			get: jest.fn(x =>
				x === 'accept-encoding' ? 'plain,gzip' : void x
			),
		};

		const res = {
			set: jest.fn(),
		};

		middleware(req, res, next);

		expect(next).not.toHaveBeenCalled();

		expect(access).toHaveBeenCalled();
		const callback = access.mock.calls[0][2];
		expect(callback).toEqual(expect.any(Function));

		//manually callback the fs.access callback... with no error
		expect(() => callback()).not.toThrow();

		expect(req.url).toEqual(expect.stringMatching(/\.gz$/i));
		expect(res.set).toHaveBeenCalledTimes(2);
		expect(res.set).toHaveBeenCalledWith('Content-Encoding', 'gzip');
		expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/html');
		expect(next).toHaveBeenCalled();
	});
});
