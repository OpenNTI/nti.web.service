'use strict';
const mock = require('mock-require');
const sinon = require('sinon');
const {getModel} = require('nti-lib-interfaces');
const PageInfo = getModel('pageinfo');

describe ('lib/api/endpoints/ugd/context-data', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('registers ugd/context-data', () => {
		const {default: register} = mock.reRequire('../context-data');
		const api = {get: sandbox.stub()};

		expect(() => register(api, {}, {})).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.string, sinon.match.func);
	});


	it ('fetches the container Html', () => {
		const {default: register} = mock.reRequire('../context-data');
		const api = {get: sandbox.stub()};

		expect(() => register(api, {}, {})).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.string, sinon.match.func);
		const [, callback] = api.get.getCall(0).args;

		const pageInfo = new PageInfo({}, null, {});
		sandbox.stub(pageInfo, 'getContent').returns(Promise.resolve('html!'));

		const req = {
			ntiidObject: {
				getContainerID: sandbox.stub().returns('my-container-id')
			},
			ntiService: {
				getParsedObject: sandbox.stub().returns(Promise.resolve(pageInfo))
			}
		};

		return new Promise((finish, error) => {
			const res = {
				json: finish
			};

			callback(req, res, error);
		})
			.then(json => {
				json.should.be.ok;
				req.ntiidObject.getContainerID.should.have.been.calledOnce;
				req.ntiService.getParsedObject.should.have.been.calledOnce;
			});
	});


	it ('fetches the container - did not get pageInfo', () => {
		const {default: register} = mock.reRequire('../context-data');
		const api = {get: sandbox.stub()};

		expect(() => register(api, {}, {})).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.string, sinon.match.func);
		const [, callback] = api.get.getCall(0).args;

		const req = {
			ntiidObject: {
				getContainerID: sandbox.stub().returns('my-container-id')
			},
			ntiService: {
				getParsedObject: sandbox.stub().returns(Promise.resolve({}))
			}
		};

		return new Promise((finish, error) => {
			const res = {
				json: finish
			};

			callback(req, res, error);
		})
			.then(json => {
				json.should.be.ok;
				req.ntiidObject.getContainerID.should.have.been.calledOnce;
				req.ntiService.getParsedObject.should.have.been.calledOnce;
			});
	});
});
