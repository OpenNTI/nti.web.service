/*globals expect*/
/*eslint-env mocha*/
'use strict';
const fs = require('fs');

const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/error-handler (middleware)', () => {
	let logger, sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};

		mock('../logger', logger);
		mock('uuid/v4', () => 'some-guid');
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('expected exported api', () => {
		const use = sandbox.stub();
		const {middleware, setupErrorHandler} = mock.reRequire('../error-handler');

		sandbox.spy(fs, 'readFileSync');//must come after "reRequire"...
		setupErrorHandler.should.be.a('function');

		setupErrorHandler({use}, {});

		fs.readFileSync.should.have.been.calledOnce;
		const template = fs.readFileSync.returnValues[0];
		template.should.be.a('string');
		template.should.not.be.empty;
		use.should.have.been.calledWithExactly(middleware);
	});


	it ('middleware is a function with 4 arguments (express error handler)', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');

		fn.should.be.a('function');
		fn.length.should.be.equal(4);
	});


	it ('the error middleware function does not call next()', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		expect(() => fn(new Error(), null, res, next)).to.not.throw().and.to.equal(void 0);

		next.should.have.not.been.called;
	});


	it ('the error middleware function: error implements toJSON...', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		const json = {abc: '123'};
		const err = {toJSON: () => json};
		sandbox.spy(err, 'toJSON');

		expect(() => fn(err, null, res, next)).to.not.throw().and.to.equal(void 0);

		err.toJSON.should.have.been.calledOnce;
		res.status.should.have.been.calledOnce;
		res.status.should.have.been.calledWith(500);
	});

	it ('the error middleware function: error thats a JSO', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		const err = {abc: '123'};

		expect(() => fn(err, null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledOnce;
		res.status.should.have.been.calledWith(500);
	});


	it ('the error middleware function: handles aborted', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		expect(() => fn('aborted', null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledWithExactly(204);
		res.end.should.have.been.called;
		res.send.should.not.have.been.called;
	});


	it ('the error middleware function: handles missing errors', () => {
		const handler = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');
		sandbox.stub(handler, 'preprocess').returns('Unknown');

		expect(() => handler.middleware(null, null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledWithExactly(500);
		res.send.should.have.been.calledWithExactly('Unknown');
		res.end.should.not.have.been.called;
	});


	it ('the error middleware function: handles template blowing up', () => {
		const handler = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');
		sandbox.stub(handler, 'preprocess').throws(new Error('surprise!'));

		expect(() => handler.middleware(null, null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledWithExactly(500);
		res.send.should.have.been.calledWithExactly('Couldn\'t populate error template.');
		res.end.should.not.have.been.called;
	});


	it ('the error middleware function: handles 503', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		expect(() => fn({statusCode: 503, message: '__'}, null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledWithExactly(503);
		res.send.should.have.been.calledWithExactly('__');
		res.end.should.not.have.been.called;
	});


	it ('the error middleware function: handles implicit 503', () => {
		const {middleware: fn} = mock.reRequire('../error-handler');
		const next = sandbox.stub();
		const res = {
			end () {return this;},
			send () {return this;},
			status () {return this;}
		};

		sandbox.spy(res, 'end');
		sandbox.spy(res, 'send');
		sandbox.spy(res, 'status');

		expect(() => fn({message: 'Service Unavailable'}, null, res, next)).to.not.throw().and.to.equal(void 0);

		res.status.should.have.been.calledWithExactly(503);
		res.send.should.have.been.calledWithExactly('Service Unavailable');
		res.end.should.not.have.been.called;
	});


	it ('fills in template', () => {
		const {preprocess} = mock.reRequire('../error-handler');

		const data = {
			blank: void 0,
			abc: '123',
			xyz: '456'
		};
		const templateStr = '{blank}{abc}{xyz}{notset}';

		const output = preprocess(templateStr, data);

		output.should.equal('123456');
	});
});
