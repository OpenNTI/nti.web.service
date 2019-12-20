/*eslint-env jest*/
'use strict';

const {SERVER_REF} = require('../../../constants');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe ('lib/api/endpoints/user-agreement', () => {
	let TOS_NOT_ACCEPTED;

	beforeEach(() => {
		jest.resetModules();
		global.fetch = () => {};

		TOS_NOT_ACCEPTED = require('@nti/lib-interfaces').TOS_NOT_ACCEPTED;
	});


	afterEach(() => {
		delete global.fetch;
		jest.resetModules();
	});


	test ('registers user-agreement', () => {
		const UA = require('../user-agreement');
		const handler = jest.fn();
		stub(UA, 'getServeUserAgreement', () => handler);
		const {default: register} = UA;
		const api = {get: jest.fn()};

		const config = {config: 1};
		expect(() => register(api, config)).not.toThrow();
		expect(api.get).toHaveBeenCalledTimes(1);
		expect(api.get).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
		const [, callback] = api.get.mock.calls[0];

		expect(UA.getServeUserAgreement).toHaveBeenCalledTimes(1);
		expect(UA.getServeUserAgreement).toHaveBeenCalledWith(config);

		expect(handler).not.toHaveBeenCalled;
		expect(() => callback(1, 2)).not.toThrow();
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith(1, 2);
	});


	test ('getServeUserAgreement(): returns a handler fuction', () => {
		const UA = require('../user-agreement');

		const handler = UA.getServeUserAgreement();
		expect(handler).toEqual(expect.any(Function));
	});


	test ('getServeUserAgreement(): handler behavior', async () => {
		const context = {context: 1};
		const UA = require('../user-agreement');
		stub(UA, 'resolveUrl', () => Promise.resolve({url: '...', context}));
		stub(UA, 'handleFetch', () => () => Promise.resolve({fetch: 1}));
		stub(UA, 'handleFetchResponse', () => Promise.resolve({fetchResponse: 1}));
		stub(UA, 'processAndRespond', () => () => Promise.resolve({processed: 1}));

		const config = {config: 1};
		const server = {server: 1};

		const handler = UA.getServeUserAgreement(config);

		const req = {req: 1, [SERVER_REF]: server};
		const res = {res: 1};
		const next = jest.fn();

		await handler(req, res, next);

		expect(UA.resolveUrl).toHaveBeenCalledTimes(1);
		expect(UA.resolveUrl).toHaveBeenCalledWith(req, config, server);

		expect(UA.handleFetch).toHaveBeenCalledTimes(1);
		expect(UA.handleFetch).toHaveBeenCalledWith(req, res);

		expect(UA.handleFetchResponse).toHaveBeenCalledTimes(1);
		expect(UA.handleFetchResponse).toHaveBeenCalledWith({fetch: 1});

		expect(UA.processAndRespond).toHaveBeenCalledTimes(1);
		expect(UA.processAndRespond).toHaveBeenCalledWith(res);

		expect(next).toHaveBeenCalledTimes(0);
	});


	test ('getServeUserAgreement(): handler rejects if no url', async () => {
		const UA = require('../user-agreement');
		stub(UA, 'resolveUrl', () => Promise.resolve());
		stub(UA, 'handleFetch', () => () => Promise.resolve({fetch: 1}));
		stub(UA, 'handleFetchResponse', () => Promise.resolve({fetchResponse: 1}));
		stub(UA, 'processAndRespond', () => () => Promise.resolve({processed: 1}));

		const config = {config: 1};
		const server = {server: 1};

		const handler = UA.getServeUserAgreement(config, server);

		const req = {req: 1};
		const res = {res: 1};
		const next = jest.fn();

		await handler(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});


	test ('resolveUrl(): server defines url', async () => {
		const {resolveUrl} = require('../user-agreement');

		const pong = {
			Links: [
				{
					href: '/dataserver2/@@some-url',
					rel: TOS_NOT_ACCEPTED
				}
			]
		};

		const server = {
			get: jest.fn(x => x === 'logon.ping' ? Promise.resolve(pong) : void 0)
		};

		const config = {
			'server': 'http://localhost:8082/dataserver2/',
			'user-agreement': 'https://some-fallback-url'
		};

		const request = {request: 1, protocol: 'http', headers: {host: 'localhost:8082'}};

		const o = await resolveUrl(request, config, server);

		expect(o.url).toEqual(expect.any(String));
		expect(o.url.startsWith(config.server)).toBeTruthy();

		expect(o.context).toBeTruthy();
		expect(o.context).toHaveProperty('headers');
		expect(o.context).toHaveProperty('redirect');
	});


	test ('resolveUrl(): config fallback url', async () => {
		const {resolveUrl} = require('../user-agreement');

		const pong = {};

		const server = {
			get: jest.fn(x => x === 'logon.ping' ? Promise.resolve(pong) : void 0)
		};

		const config = {
			'server': 'http://localhost:8082/dataserver2/',
			'user-agreement': 'https://some-fallback-url'
		};

		const request = {request: 1, protocol: 'http', headers: {host: 'localhost:8082'}};

		const o = await resolveUrl(request, config, server)

		expect(o.url).toEqual(expect.any(String));
		expect(o.url.startsWith(config.server)).toBeFalsy();
		expect(o.url.startsWith(config['user-agreement'])).toBeTruthy();

		expect(o.context).toEqual(undefined);
	});


	test ('resolveUrl(): error case', async () => {
		const {resolveUrl} = require('../user-agreement');
		const request = {request: 1, protocol: 'http', headers: {host: 'localhost:8082'}};
		const server = {
			get: jest.fn(x => x === 'logon.ping' ? Promise.resolve() : void x)
		};


		const o = await resolveUrl(request, null, server);

		expect(o).toEqual(undefined);
	});


	test ('copyRequestHeaders(): copies all headers except the blacklisted', () => {
		const {copyRequestHeaders} = require('../user-agreement');

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

		expect(() => copyRequestHeaders()).not.toThrow();

		const newHeaders = copyRequestHeaders(req);
		//is not the same ref, and is a new object
		expect(newHeaders).not.toBe(req.headers);

		//has less properties than the original
		expect(Object.keys(newHeaders).length).toBeLessThan(Object.keys(req.headers).length);

		//no new headers
		for (let header of Object.keys(newHeaders)) {
			expect(req.headers).toHaveProperty(header);
		}

	});


	test ('handleFetch(): normal', () => {
		const {handleFetch} = require('../user-agreement');
		stub(global, 'fetch');

		const url = 'test';
		const context = {context: 1};
		const req = {url: 'some-url'};
		const resp = {};

		const handler = handleFetch(req, resp);
		handler({url, context});

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(url, context);
	});


	test ('handleFetch(): redirect', () => {
		const {handleFetch} = require('../user-agreement');

		const url = 'test';
		const context = {context: 1};
		const req = {url: 'some-url/view'};
		const resp = {
			redirect: jest.fn()
		};

		const handler = handleFetch(req, resp);
		handler({url, context});

		expect(resp.redirect).toHaveBeenCalledTimes(1);
		expect(resp.redirect).toHaveBeenCalledWith(url);
	});


	test ('handleFetchResponse(): normal', async () => {
		const {handleFetchResponse} = require('../user-agreement');

		const responseMock = {
			ok: true,
			text: jest.fn(() => 'response-text')
		};

		const text = await Promise.resolve(handleFetchResponse(responseMock));
		expect(text).toEqual('response-text');
	});


	test ('handleFetchResponse(): redirect', async () => {
		const {handleFetchResponse} = require('../user-agreement');

		const get = jest.fn(x => x === 'location' ? 'new-place' : void x);

		stub(global, 'fetch', (x) => {
			if (x === 'new-place') {
				return Promise.resolve({
					ok: true,
					text: jest.fn(() => 'response-text')
				});
			}

			return Promise.resolve({ok: false, status: 404, statusText: 'Not Found'});
		});


		const text = await Promise.resolve(handleFetchResponse({ ok: false, status: 302, headers: { get } }));
		expect(text).toEqual('response-text');
	});


	test ('handleFetchResponse(): error', async () => {
		const {handleFetchResponse} = require('../user-agreement');

		try {
			await Promise.resolve(handleFetchResponse({ ok: false, status: 404, statusText: 'Not Found' }));
			return await Promise.reject('Unexpected Promise fulfillment. It should have failed.');
		}
		catch (er) {
			expect(er).toEqual(expect.any(Error));
			expect(er.message).toEqual('Not Found');
		}

	});


	test ('processAndRespond(): returns a handler', () => {
		const {processAndRespond} = require('../user-agreement');

		const handler = processAndRespond();
		expect(handler).toEqual(expect.any(Function));
	});


	test ('processAndRespond(): encodes a {body, styles} data structure, body string is stripped of script and style tags, style string is the sum of all style tags contents.', () => {
		const {processAndRespond} = require('../user-agreement');
		const responseMock = {
			status: jest.fn(),
			json: jest.fn(),
			end: jest.fn()
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

		expect(responseMock.status).toHaveBeenCalledTimes(1);
		expect(responseMock.status).toHaveBeenCalledWith(200);


		expect(responseMock.json).toHaveBeenCalledTimes(1);
		expect(responseMock.json).toHaveBeenCalledWith({body: expect.any(String), styles: expect.any(String)});
		const [data] = responseMock.json.mock.calls[0];

		expect(data.body).not.toEqual(expect.stringContaining('<script'));
		expect(data.body).not.toEqual(expect.stringContaining('</script>'));
		expect(data.body).not.toEqual(expect.stringContaining('<style'));
		expect(data.body).not.toEqual(expect.stringContaining('</style>'));

		expect(data.styles).toEqual(expect.stringContaining('#test1'));
		expect(data.styles).toEqual(expect.stringContaining('#test2'));

		expect(responseMock.end).toHaveBeenCalledTimes(1);
		expect(responseMock.end).toHaveBeenCalledWith();


	});
});
