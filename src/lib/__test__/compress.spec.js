/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/compress (middleware)', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('attachToExpress adds two middleware, one to serve precompressed gz files, and one to fallback to dynamicly compress.', () => {
		const compression = {};
		const precompressed = {};
		const use = sandbox.stub();
		const compressionFactory = sandbox.stub().returns(compression);

		mock('compression', compressionFactory);
		const o = mock.reRequire('../compress');
		sandbox.stub(o, 'precompressed').returns(precompressed);

		o.attachToExpress({use});

		compressionFactory.should.have.been.calledOnce;

		use.should.have.been.calledTwice
			.and.calledWithExactly(precompressed)
			.and.calledWithExactly(compression);
	});


	it ('compression filter function returns false when the request has x-no-compression header', () => {
		const filter = sandbox.stub().returns(true);
		mock('compression', {filter});
		const {compressionFilter} = mock.reRequire('../compress');

		const req = {url: '/', get: sandbox.stub()};
		req.get.withArgs('x-no-compression').returns(true);

		compressionFilter(req).should.be.false;
		filter.should.not.have.called;
	});


	it ('compression filter function returns false when the request url ends in .gz', () => {
		const filter = sandbox.stub().returns(true);
		mock('compression', {filter});
		const {compressionFilter} = mock.reRequire('../compress');

		const req = {url: '/index.js.gz', get: sandbox.stub()};

		compressionFilter(req).should.be.false;
		filter.should.not.have.called;
	});


	it ('compression filter function calls fallback filter when url does not end in .gz nor have header-block', () => {
		const filter = sandbox.stub().returns(true);
		mock('compression', {filter});
		const {compressionFilter} = mock.reRequire('../compress');

		const req = {url: '/index.js', get: sandbox.stub()};

		compressionFilter(req).should.be.true;
		filter.should.have.called;
	});


	it ('precompressed() bypass: requests that have x-no-compression header', () => {
		const filter = sandbox.stub().returns(true);
		const next = sandbox.stub();
		const access = sandbox.stub();
		mock('compression', {filter});
		mock('fs', {access});
		const {precompressed} = mock.reRequire('../compress');

		const middleware = precompressed('/');
		middleware.should.be.a('function');

		const req = Object.freeze({
			url: '/foobar',
			get: sandbox.stub()
		});

		req.get.withArgs('x-no-compression').returns(true);
		req.get.withArgs('accept-encoding').returns('plain,gzip');

		middleware(req, null, next);

		next.should.have.been.called;
		access.should.not.have.been.called;
	});


	it ('precompressed() bypass: requests that do not declare support', () => {
		const filter = sandbox.stub().returns(true);
		const next = sandbox.stub();
		const access = sandbox.stub();
		mock('compression', {filter});
		mock('fs', {access});
		const {precompressed} = mock.reRequire('../compress');

		const middleware = precompressed('/');
		middleware.should.be.a('function');

		const req = Object.freeze({
			url: '/foobar',
			get: sandbox.stub()
		});
		req.get.withArgs('accept-encoding').returns('');

		middleware(req, null, next);

		next.should.have.been.called;
		access.should.not.have.been.called;
	});


	it ('precompressed() bypass: file access errors', () => {
		const filter = sandbox.stub().returns(true);
		const next = sandbox.stub();
		const access = sandbox.stub();
		mock('compression', {filter});
		mock('fs', {access});
		const {precompressed} = mock.reRequire('../compress');

		const middleware = precompressed('/');
		middleware.should.be.a('function');

		const res = {
			set: sandbox.stub()
		};

		const req = Object.freeze({
			url: '/foobar',
			get: sandbox.stub()
		});

		req.get.withArgs('accept-encoding').returns('plain,gzip');

		middleware(req, res, next);

		next.should.not.have.been.called;

		access.should.have.been.called;
		const callback = access.getCall(0).args[2];
		callback.should.be.a('function');

		//manually callback the fs.access callback... with an error
		expect(() => callback(new Error('oops'))).to.not.throw();

		//By getting here, the 'req' object had not been modified (the freeze would make modifications to throw, and fail the test)
		res.set.should.not.have.been.called;
		next.should.have.been.called;
	});


	it ('precompressed(): switches the static asset to the .gz and adds changes encodeing', () => {
		const filter = sandbox.stub().returns(true);
		const next = sandbox.stub();
		const access = sandbox.stub();
		mock('compression', {filter});
		mock('fs', {access});
		const {precompressed} = mock.reRequire('../compress');

		const middleware = precompressed('/');
		middleware.should.be.a('function');

		const req = {
			url: '/foobar',
			get: sandbox.stub()
		};

		const res = {
			set: sandbox.stub()
		};

		req.get.withArgs('accept-encoding').returns('plain,gzip');

		middleware(req, res, next);

		next.should.not.have.been.called;

		access.should.have.been.called;
		const callback = access.getCall(0).args[2];
		callback.should.be.a('function');

		//manually callback the fs.access callback... with no error
		expect(() => callback()).to.not.throw();

		req.url.should.match(/\.gz$/i);
		res.set.should.have.been.calledOnce
			.and.calledWithExactly('Content-Encoding', 'gzip');
		next.should.have.been.called;
	});

	it ('precompressed(): switches the static asset to the .gz and adds changes encodeing, enforcing known Content-Types', () => {
		const filter = sandbox.stub().returns(true);
		const next = sandbox.stub();
		const access = sandbox.stub();
		mock('compression', {filter});
		mock('fs', {access});
		const {precompressed} = mock.reRequire('../compress');

		const middleware = precompressed('/');
		middleware.should.be.a('function');

		const req = {
			url: '/foobar.html',
			get: sandbox.stub()
		};

		const res = {
			set: sandbox.stub()
		};

		req.get.withArgs('accept-encoding').returns('plain,gzip');

		middleware(req, res, next);

		next.should.not.have.been.called;

		access.should.have.been.called;
		const callback = access.getCall(0).args[2];
		callback.should.be.a('function');

		//manually callback the fs.access callback... with no error
		expect(() => callback()).to.not.throw();

		req.url.should.match(/\.gz$/i);
		res.set.should.have.been.calledTwice
			.and.calledWithExactly('Content-Encoding', 'gzip')
			.and.calledWithExactly('Content-Type', 'text/html');
		next.should.have.been.called;
	});

});
