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
		const m = {default: registerEndpoint};
		mock('../health-check', m);
		mock('../user-agreement', m);
		mock('../ugd/context-data', m);
		const register = mock.reRequire('../index');

		expect(() => register(1, 2, 3)).to.not.throw();
		registerEndpoint.should.always.have.been.calledWithExactly(1, 2, 3);
	});
});
