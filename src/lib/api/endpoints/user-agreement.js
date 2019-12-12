'use strict';
const Url = require('url');

const {TOS_NOT_ACCEPTED, getLink} = require('@nti/lib-interfaces');

const {getStackOrMessage} = require('../../utils');
const {SERVER_REF} = require('../../constants');

const tagPattern = tag => new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'ig');
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body/i;//no g
const SHOULD_REDIRECT = RegExp.prototype.test.bind(/\/view/);

const self = Object.assign(exports, {
	default: register,
	copyRequestHeaders,
	handleError,
	handleFetch,
	handleFetchResponse,
	processAndRespond,
	getServeUserAgreement,
	resolveUrl
});



function register (api, config) {
	const handler = self.getServeUserAgreement(config);
	api.get(/^\/user-agreement/, async (req, res) => void await handler(req, res));
}


function getServeUserAgreement (config) {

	return function handler (req, res) {
		const server = req[SERVER_REF];

		return self.resolveUrl(req, config, server)

			.then(o => o || Promise.reject(new Error('No user-agreement url set')))

			.then(self.handleFetch(req, res))

			.then(self.handleFetchResponse)

			.then(self.processAndRespond(res))

			.catch(self.handleError(res));
	};
}


function resolveUrl (request, config, server) {
	const {server: host, ['user-agreement']: fallbackUrl} = config || {};
	const SERVER_CONTEXT = request;

	return server.get('logon.ping', SERVER_CONTEXT)
		.then(pong => getLink(pong, TOS_NOT_ACCEPTED))

		.then(url => {
			url = Url.parse(host || '').resolve(url || fallbackUrl || '');

			//If there is a @NamedLink we have to pass request context,
			//if its an external link like docs.google... blank out context.
			const context = (url && url.startsWith(host))
				? {headers: self.copyRequestHeaders(request), redirect: 'manual'}
				: void 0;

			return !url ? void 0 : {
				url,
				context
			};
		});
}


function copyRequestHeaders (req) {
	const blacklist = ['accept-encoding', 'content-length', 'content-type', 'referer'];

	const headers = { ...(req || {}).headers || {}};
	for (let header of blacklist) {
		delete headers[header];
	}

	return headers;
}


function handleError (response) {
	return (e) => {
		response.status(500);
		response.json({body: getStackOrMessage(e)});
		response.end();
	};
}


function handleFetch (request, response) {
	return ({url, context}) => {

		if (SHOULD_REDIRECT(request.url)) {
			response.redirect(url);
			return;
		}

		return fetch(url, context);
	};
}


function handleFetchResponse (response) {
	if (!response.ok) {
		if (response.status >= 300 && response.status < 400) {
			const redirectURL = response.headers.get('location');
			return fetch(redirectURL).then(handleFetchResponse);
		}

		return Promise.reject(new Error(response.statusText));
	}

	return response.text();
}


function processAndRespond (response) {
	return (raw) => {
		const filtered = raw
			.replace(tagPattern('script'), '')
			.replace(tagPattern('style'), '');


		const body = BODY_REGEX.exec(filtered);
		const styles = [];

		const stylePattern = tagPattern('style');
		for (let m; (m = stylePattern.exec(raw));) {
			styles.push(m[1]);
		}

		const data = {
			// html: response,
			body: body && body[1],
			styles: styles.join('\n\n')
		};

		response.status(200);
		response.json(data);
		response.end();
	};
}
