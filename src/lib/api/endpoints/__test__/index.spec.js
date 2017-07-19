/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');


describe ('lib/api/endpoints/index', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('endpoint index registers all the endpoints', () => {
		const registerEndpoint = sandbox.stub();
		mock('../health-check', {default: registerEndpoint});
		mock('../user-agreement', {default: registerEndpoint});
		mock('../ugd/context-data', {default: registerEndpoint});
		const register = mock.reRequire('../index');

		expect(() => register(1, 2, 3)).to.not.throw();
		registerEndpoint.should.have.been.calledThrice;
		registerEndpoint.should.always.have.been.calledWithExactly(1, 2, 3);
	});
});
