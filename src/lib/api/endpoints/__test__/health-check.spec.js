/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');


describe ('lib/api/endpoints/heath-check', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('registers _ops/ping', () => {
		const {default: register} = mock.reRequire('../health-check');
		const api = {get: sandbox.stub()};

		expect(() => register(api, {}, {})).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.regexp, sinon.match.func);
	});


	it ('_ops/ping calls server.get(_ops/ping)', () => {
		const {default: register} = mock.reRequire('../health-check');
		const api = {get: sandbox.stub()};
		const server = {get: sandbox.stub().returns(Promise.resolve())};

		expect(() => register(api, {}, server)).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.regexp, sinon.match.func);
		const [, callback] = api.get.getCall(0).args;
		const res = {
			status: sandbox.stub()
		};

		return new Promise(finish => {
			res.end = finish;
			callback(context, res);
		})
			.then(() => {
				res.status.should.have.been.calledOnce;
				res.status.should.have.been.calledWithExactly(200);
			});
	});


	it ('_ops/ping 503\'s if anything goes wrong.', () => {
		const {default: register} = mock.reRequire('../health-check');
		const api = {get: sandbox.stub()};
		const server = {get: sandbox.stub().returns(Promise.reject())};

		expect(() => register(api, {}, server)).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.regexp, sinon.match.func);
		const [, callback] = api.get.getCall(0).args;
		const res = {
			status: sandbox.stub()
		};

		return new Promise(finish => {
			res.end = finish;
			callback(context, res);
		})
			.then(() => {
				res.status.should.have.been.calledOnce;
				res.status.should.have.been.calledWithExactly(503);
			});
	});
});
