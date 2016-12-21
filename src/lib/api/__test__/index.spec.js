'use strict';
const mock = require('mock-require');
const sinon = require('sinon');


describe ('lib/api - index', () => {
	let logger;
	let sandbox;
	let expressMock;
	let endpoints;
	let getServiceDocument;
	let getParsedObject;
	let doc;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
			get: sandbox.stub().returns(logger)
		};

		getParsedObject = sandbox.spy(id => ({NTIID: id}));
		doc = {getParsedObject};
		endpoints = sandbox.stub();
		getServiceDocument = sandbox.stub().returns(Promise.resolve(doc));

		expressMock = sandbox.spy(() => Object.create(expressMock, {
			param: {value: sandbox.stub()},
			use: {value: sandbox.stub()},
			get: {value: sandbox.stub()}
		}));

		mock('../../logger', logger);
		mock('../endpoints', endpoints);
		mock('express', expressMock);
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('registerEndPoints(): attaches endpoints to api/*', () => {
		const app = {use: sandbox.stub()};
		const register = mock.reRequire('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expressMock.should.have.been.calledOnce;
		const api = expressMock.getCall(0).returnValue;
		api.should.be.ok;

		app.use.should.have.been.calledOnce;
		app.use.should.have.been.calledWith(sinon.match.regexp, sinon.match({use: sinon.match.func}));

		endpoints.should.have.been.calledOnce;
		endpoints.should.have.been.calledWithExactly(api, config, dataserver);

		api.param.should.have.been.calledOnce;
		api.param.should.have.been.calledWithExactly('ntiid', sinon.match.func);

		api.use.should.have.been.calledOnce;
		api.use.should.have.been.calledWithExactly(sinon.match.func);

		api.ServiceMiddleWare.should.be.a('function');
		api.ServiceMiddleWare.length.should.equal(3);
	});


	it ('registerEndPoints(): ServiceMiddleWare', () => {
		const app = {use: sandbox.stub()};
		const register = mock.reRequire('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expressMock.should.have.been.calledOnce;
		const api = expressMock.getCall(0).returnValue;
		api.should.be.ok;

		api.ServiceMiddleWare.should.be.a('function');
		api.ServiceMiddleWare.length.should.equal(3);

		const req = {};
		const res = {};
		const next = sandbox.stub();

		return Promise.resolve(api.ServiceMiddleWare(req, res, next))
			.then(result => {
				expect(result).to.be.an('undefined');
				req.ntiService.should.be.equal(doc);

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly();
				next.reset();

				getServiceDocument.should.have.been.calledOnce;
				getServiceDocument.should.have.been.calledWith(req);
				getServiceDocument.reset();
			})

			.then(() => api.ServiceMiddleWare(req, res, next))
			.then(result => {
				expect(result).to.be.an('undefined');
				req.ntiService.should.be.equal(doc);

				next.should.have.been.calledOnce;
				next.should.have.been.calledWithExactly();

				getServiceDocument.should.not.have.been.called;
			});
	});


	it ('registerEndPoints(): param filter should fetch object', () => {
		const app = {use: sandbox.stub()};
		const register = mock.reRequire('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expressMock.should.have.been.calledOnce;
		const api = expressMock.getCall(0).returnValue;

		const req = {ntiService: doc};
		const res = {};
		const id = 'some-object-id';


		api.param.should.have.been.callledOnce;
		api.param.should.have.been.calledWithExactly('ntiid', sinon.match.func);
		const callback = api.param.getCall(0).args[1];
		callback.length.should.equal(4);

		return new Promise((finish, err) => callback(req, res, (e) => e ? err(e) : finish(), id))
			.then(() => {
				req.ntiidObject.should.be.ok;
				req.ntiidObject.NTIID.should.equal(id);
			});
	});


	it ('registerEndPoints(): error handler', () => {
		const app = {use: sandbox.stub()};
		const register = mock.reRequire('../index');
		const config = {};
		const dataserver = {getServiceDocument};

		register(app, config, dataserver);

		expressMock.should.have.been.calledOnce;
		const api = expressMock.getCall(0).returnValue;

		const next = sandbox.stub();
		const req = {ntiService: doc};
		const res = {
			end: sandbox.spy(() => res),
			json: sandbox.spy(() => res),
			status: sandbox.spy(() => res)
		};

		api.use.should.have.been.callledOnce;
		api.use.should.have.been.calledWithExactly(sinon.match.func);
		const callback = api.use.getCall(0).args[0];
		callback.length.should.equal(4);

		const err = {
			stack: '',
			message: 'error-message'
		};

		callback(err, req, res, next);

		next.should.not.have.been.called;
		logger.error.should.have.been.calledOnce;
		logger.error.should.have.been.calledWith(sinon.match.string);

		res.status.should.have.been.calledOnce;
		res.status.should.have.been.calledWithExactly(500);

		res.json.should.have.been.calledOnce;
		res.json.should.have.been.calledWithExactly(sinon.match({stack: err.stack, message: err.message}));

		res.end.should.have.been.calledOnce;
		res.end.should.have.been.calledWithExactly();
	});
});
