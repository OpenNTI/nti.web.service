/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/no-cache (middleware)', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('exports a middleware function', () => {
		const fn = mock.reRequire('../no-cache');

		fn.should.be.a('function');
		fn.length.should.be.equal(3);
	});


	it ('the middleware function calls next()', () => {
		const fn = mock.reRequire('../no-cache');
		const next = sandbox.stub();
		const res = {setHeader: sandbox.stub()};

		expect(() => fn(null, res, next)).to.not.throw().and.to.equal(void 0);

		next.should.have.been.calledOnce;
		next.should.have.been.calledWithExactly();
	});


	it ('the middleware function sets no-cache headers on the response', () => {
		const next = () => ({});
		const fn = mock.reRequire('../no-cache');
		const res = {setHeader: sandbox.stub()};

		expect(() => fn(null, res, next)).to.not.throw().and.to.equal(void 0);

		res.setHeader.should.have.been.calledThrice
			.and.calledWithExactly('Cache-Control', 'private, no-cache, no-store, ' +
													'must-revalidate, max-stale=0, ' +
													'post-check=0, pre-check=0')
			.and.calledWithExactly('Expires', '-1')
			.and.calledWithExactly('Pragma', 'no-cache');
	});


	it ('does not call setHeader if headers already sent.', () => {
		const next = () => ({});
		const fn = mock.reRequire('../no-cache');
		const res = {headersSent: true, setHeader: sandbox.stub()};

		expect(() => fn(null, res, next)).to.not.throw().and.to.equal(void 0);

		res.setHeader.should.not.have.been.called;
	});

});
