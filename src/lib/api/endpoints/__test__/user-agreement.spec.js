'use strict';
const mock = require('mock-require');
const sinon = require('sinon');
const {TOS_NOT_ACCEPTED} = require('nti-lib-interfaces');


describe ('lib/api/endpoints/user-agreement', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});


	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});


	it ('registers user-agreement', () => {
		const UA = mock.reRequire('../user-agreement');
		const handler = sandbox.stub();
		sandbox.stub(UA, 'getServeUserAgreement', () => handler);
		const {default: register} = UA;
		const api = {get: sandbox.stub()};

		const config = {config: 1};
		const server = {server: 1};
		expect(() => register(api, config, server)).to.not.throw();
		api.get.should.have.been.calledOnce;
		api.get.should.have.been.calledWithExactly(sinon.match.regexp, sinon.match.func);
		const [, callback] = api.get.getCall(0).args;

		UA.getServeUserAgreement.should.have.been.calledOnce;
		UA.getServeUserAgreement.should.have.been.calledWithExactly(config, server);

		handler.should.not.have.been.called;
		expect(() => callback(1, 2)).to.not.throw();
		handler.should.have.been.calledOnce;
		handler.should.have.been.calledWithExactly(1, 2);
	});


	it ('getServeUserAgreement(): returns a handler fuction', () => {
		const UA = mock.reRequire('../user-agreement');

		const handler = UA.getServeUserAgreement();
		handler.should.be.a('function');
	});


	it ('getServeUserAgreement(): handler behavior', () => {
		const context = {context: 1};
		const UA = mock.reRequire('../user-agreement');
		sandbox.stub(UA, 'resolveUrl', () => Promise.resolve({url: '...', context}));
		sandbox.stub(UA, 'handleFetch', () => () => Promise.resolve({fetch: 1}));
		sandbox.stub(UA, 'handleFetchResponse', () => Promise.resolve({fetchResponse: 1}));
		sandbox.stub(UA, 'processAndRespond', () => () => Promise.resolve({processed: 1}));
		sandbox.stub(UA, 'handleError', () => {});

		const config = {config: 1};
		const server = {server: 1};

		const handler = UA.getServeUserAgreement(config, server);

		const req = {req: 1};
		const res = {res: 1};
		return handler(req, res)
			.then(() => {
				UA.resolveUrl.should.have.been.calledOnce;
				UA.resolveUrl.should.have.been.calledWithExactly(req, config, server);

				UA.handleFetch.should.have.been.calledOnce;
				UA.handleFetch.should.have.been.calledWithExactly(req, res);

				UA.handleFetchResponse.should.have.been.calledOnce;
				UA.handleFetchResponse.should.have.been.calledWithExactly({fetch: 1});

				UA.processAndRespond.should.have.been.calledOnce;
				UA.processAndRespond.should.have.been.calledWithExactly(res);

				UA.handleError.should.have.been.calledOnce;
				UA.handleError.should.have.been.calledWithExactly(res);
			});
	});


	it ('getServeUserAgreement(): handler rejects if no url', () => {
		const UA = mock.reRequire('../user-agreement');
		const errorHandler = sandbox.stub();
		sandbox.stub(UA, 'resolveUrl', () => Promise.resolve());
		sandbox.stub(UA, 'handleFetch', () => () => Promise.resolve({fetch: 1}));
		sandbox.stub(UA, 'handleFetchResponse', () => Promise.resolve({fetchResponse: 1}));
		sandbox.stub(UA, 'processAndRespond', () => () => Promise.resolve({processed: 1}));
		sandbox.stub(UA, 'handleError', () => errorHandler);

		const config = {config: 1};
		const server = {server: 1};

		const handler = UA.getServeUserAgreement(config, server);

		const req = {req: 1};
		const res = {res: 1};
		return handler(req, res)
			.then(() => {
				UA.handleError.should.have.been.calledOnce;
				UA.handleError.should.have.been.calledWithExactly(res);

				errorHandler.should.have.been.calledOnce;
				errorHandler.should.have.been.calledWithExactly(sinon.match.instanceOf(Error));
			});
	});


	it ('resolveUrl(): server defines url', () => {
		const {resolveUrl} = mock.reRequire('../user-agreement');

		const pong = {
			Links: [
				{
					href: '/dataserver2/@@some-url',
					rel: TOS_NOT_ACCEPTED
				}
			]
		};

		const server = {
			get: sandbox.stub().withArgs('logon.ping').returns(Promise.resolve(pong))
		};

		const config = {
			'server': 'http://localhost:8082/dataserver2/',
			'user-agreement': 'https://some-fallback-url'
		};

		const request = {request: 1};

		return resolveUrl(request, config, server)
			.then(o => {
				o.url.should.be.a('string');
				o.url.startsWith(config.server).should.be.true;

				o.context.should.be.ok;
				o.context.should.have.property('headers');
				o.context.should.have.property('redirect');
			});
	});


	it ('resolveUrl(): config fallback url', () => {
		const {resolveUrl} = mock.reRequire('../user-agreement');

		const pong = {};

		const server = {
			get: sandbox.stub().withArgs('logon.ping').returns(Promise.resolve(pong))
		};

		const config = {
			'server': 'http://localhost:8082/dataserver2/',
			'user-agreement': 'https://some-fallback-url'
		};

		const request = {request: 1};

		return resolveUrl(request, config, server)
			.then(o => {
				o.url.should.be.a('string');
				o.url.startsWith(config.server).should.be.false;
				o.url.startsWith(config['user-agreement']).should.be.true;

				expect(o.context).to.be.an('undefined');
			});
	});


	it ('resolveUrl(): error case', () => {
		const {resolveUrl} = mock.reRequire('../user-agreement');
		const request = {request: 1};
		const server = {
			get: sandbox.stub().withArgs('logon.ping').returns(Promise.resolve())
		};


		return resolveUrl(request, null, server)
			.then(o => {
				expect(o).to.be.an('undefined');
			});
	});


	it ('copyRequestHeaders(): copies all headers except the blacklisted', () => {
		const {copyRequestHeaders} = mock.reRequire('../user-agreement');

		const req = {
			headers: {
				'accept-encoding': 'some-value',
				'content-length': 'some-value',
				'content-type': 'some-value',
				'referer': 'some-value',
				'x-test-header': 'abc',
				'cookies': 'xyz'
			}
		};

		expect(() => copyRequestHeaders()).to.not.throw();

		const newHeaders = copyRequestHeaders(req);
		//is not the same ref, and is a new object
		expect(newHeaders).to.not.equal(req.headers);

		//has less properties than the original
		expect(Object.keys(newHeaders)).to.have.length.below(Object.keys(req.headers).length);

		//no new headers
		for (let header of Object.keys(newHeaders)) {
			req.headers.should.have.a.property(header);
		}

	});


	it ('handleError(): returns a handler', () => {
		const {handleError} = mock.reRequire('../user-agreement');

		const handler = handleError();
		handler.should.be.a('function');
	});


	it ('handleError(): handler sets status to 500, sends a json body, and closes the request', () => {
		const {handleError} = mock.reRequire('../user-agreement');
		const responseMock = {
			status: sandbox.stub(),
			json: sandbox.stub(),
			end: sandbox.stub()
		};
		const handler = handleError(responseMock);

		handler({error: 1});

		responseMock.status.should.have.been.calledOnce;
		responseMock.status.should.have.been.calledWithExactly(500);

		responseMock.json.should.have.been.calledOnce;
		responseMock.json.should.have.been.calledWithExactly({body: {error: 1}});

		responseMock.end.should.have.been.calledOnce;
		responseMock.end.should.have.been.calledWithExactly();
	});


	it ('handleFetch(): normal', () => {
		const {handleFetch} = mock.reRequire('../user-agreement');
		sandbox.stub(global, 'fetch');

		const url = 'test';
		const context = {context: 1};
		const req = {url: 'some-url'};
		const resp = {};

		const handler = handleFetch(req, resp);
		handler({url, context});

		fetch.should.have.been.calledOnce;
		fetch.should.have.been.calledWithExactly(url, context);
	});


	it ('handleFetch(): redirect', () => {
		const {handleFetch} = mock.reRequire('../user-agreement');

		const url = 'test';
		const context = {context: 1};
		const req = {url: 'some-url/view'};
		const resp = {
			redirect: sandbox.stub()
		};

		const handler = handleFetch(req, resp);
		handler({url, context});

		resp.redirect.should.have.been.calledOnce;
		resp.redirect.should.have.been.calledWithExactly(url);
	});


	it ('handleFetchResponse(): normal', () => {
		const {handleFetchResponse} = mock.reRequire('../user-agreement');

		const responseMock = {
			ok: true,
			text: sandbox.stub().returns('response-text')
		};

		return Promise.resolve(handleFetchResponse(responseMock))
			.then(text => {
				text.should.equal('response-text');
			});
	});


	it ('handleFetchResponse(): redirect', () => {
		const {handleFetchResponse} = mock.reRequire('../user-agreement');

		const get = sandbox.stub();
		get.withArgs('location').returns('new-place');

		sandbox.stub(global, 'fetch');
		fetch.returns(Promise.resolve({ok: false, status: 404, statusText: 'Not Found'}));
		fetch.withArgs('new-place').returns(Promise.resolve({
			ok: true,
			text: sandbox.stub().returns('response-text')
		}));


		return Promise.resolve(handleFetchResponse({ok: false, status: 302, headers: {get}}))
			.then(text => {
				text.should.equal('response-text');
			});
	});


	it ('handleFetchResponse(): error', () => {
		const {handleFetchResponse} = mock.reRequire('../user-agreement');

		return Promise.resolve(handleFetchResponse({ok: false, status: 404, statusText: 'Not Found'}))
			.then(() => Promise.reject('Unexpected Promise fulfillment. It should have failed.'))
			.catch(er => {
				er.should.be.an.instanceOf(Error);
				er.message.should.equal('Not Found');
			});

	});


	it ('processAndRespond(): returns a handler', () => {
		const {processAndRespond} = mock.reRequire('../user-agreement');

		const handler = processAndRespond();
		handler.should.be.a('function');
	});


	it ('processAndRespond(): encodes a {body, styles} data structure, body string is stripped of script and style tags, style string is the sum of all style tags contents.', () => {
		const {processAndRespond} = mock.reRequire('../user-agreement');
		const responseMock = {
			status: sandbox.stub(),
			json: sandbox.stub(),
			end: sandbox.stub()
		};

		const handler = processAndRespond(responseMock);

		const raw = `
			<html>
				<head>
					<style>
						#test1 {}
					</style>
				</head>
				<body>
					<script>alert()</script>
					<style scoped>
						#test2 {}
					</style>
					<p>test</p>
					<h1>o</h1>
				</body>
			</html>
		`;

		handler(raw);

		responseMock.status.should.have.been.calledOnce;
		responseMock.status.should.have.been.calledWithExactly(200);


		responseMock.json.should.have.been.calledOnce;
		responseMock.json.should.have.been.calledWithExactly({body: sinon.match.string, styles: sinon.match.string});
		const [data] = responseMock.json.getCall(0).args;

		data.body.should.not.have.string('<script');
		data.body.should.not.have.string('</script>');
		data.body.should.not.have.string('<style');
		data.body.should.not.have.string('</style>');

		data.styles.should.have.string('#test1');
		data.styles.should.have.string('#test2');

		responseMock.end.should.have.been.calledOnce;
		responseMock.end.should.have.been.calledWithExactly();


	});
});
