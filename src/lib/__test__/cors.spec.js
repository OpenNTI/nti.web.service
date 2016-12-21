'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/cors (middleware)', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('exports a middleware function', () => {
		const fn = mock.reRequire('../cors');

		fn.should.be.a('function');
		fn.length.should.be.equal(3);
	});


	it ('the middleware function calls next()', () => {
		const fn = mock.reRequire('../cors');
		const next = sandbox.stub();
		const res = {setHeader: sandbox.stub()};

		expect(() => fn(null, res, next)).to.not.throw().and.to.equal(void 0);

		next.should.have.been.calledOnce;
		next.should.have.been.calledWithExactly();
	});


	it ('the middleware function sets cors headers on the response', () => {
		const next = () => ({});
		const fn = mock.reRequire('../cors');
		const res = {setHeader: sandbox.stub()};

		expect(() => fn(null, res, next)).to.not.throw().and.to.equal(void 0);

		res.setHeader.should.have.been.calledTwice
			.and.calledWithExactly('Access-Control-Allow-Origin', '*')
			.and.calledWithExactly('Access-Control-Allow-Headers', 'X-Requested-With');
	});

});
