'use strict';
// const {TOS_NOT_ACCEPTED, getLink} = require('@nti/lib-interfaces');

const {SERVER_REF} = require('../../constants');

const tagPattern = tag => new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'ig');
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body/i;//no g
const SHOULD_REDIRECT = RegExp.prototype.test.bind(/\/view/);

const HardCodedToS = 'https://docs.google.com/document/d/e/2PACX-1vRJd0Irh_YFX7Ci9irWLmqrEqddrxSLrDkrJMANlCqQAo-PrLznTjk4G0hfCsjxD8M21Vd54iQ1Rqbn/pub';

const self = Object.assign(exports, {
	default: register,
	copyRequestHeaders,
	handleFetch,
	handleFetchResponse,
	processAndRespond,
	getServeUserAgreement,
	resolveUrl
});



function register (api, config) {
	api.get(/^\/user-agreement/, self.getServeUserAgreement(config));
}


function getServeUserAgreement (config) {

	return async function handler (req, res,next) {
		const server = req[SERVER_REF];
		const fetcher = self.handleFetch(req, res);
		const send = self.processAndRespond(res);

		try {
			const o = await self.resolveUrl(req, config, server);
			if (!o) {
				throw new Error('No user-agreement url set');
			}

			send(
				await self.handleFetchResponse(
					await fetcher(o)
				)
			);
		} catch(e) {
			next(e);
		}
	};
}


async function resolveUrl (request, config, server) {
	// const {['user-agreement']: fallbackUrl} = config || {};
	// const SERVER_CONTEXT = request;
	const host = `${request.protocol}://${request.headers.host}`;
	// const pong = await server.get('logon.ping', SERVER_CONTEXT);
	//TODO: there is a weird redirect issue where we end up getting the login app,
	//the quickest fix for now is to just hard code the ToS google doc link.
	let url = HardCodedToS;//getLink(pong, TOS_NOT_ACCEPTED) || fallbackUrl;

	if (url) {
		url = new URL(url, host).toString();
	}

	//If there is a @NamedLink we have to pass request context,
	//if its an external link like docs.google... blank out context.
	const context = (url && url.startsWith(host))
		? {headers: self.copyRequestHeaders(request), redirect: 'manual'}
		: void 0;

	return !url ? void 0 : {
		url,
		context
	};
}


function copyRequestHeaders (req) {
	const blacklist = ['accept-encoding', 'content-length', 'content-type', 'referer'];

	const headers = { ...(req || {}).headers || {}};
	for (let header of blacklist) {
		delete headers[header];
	}

	return headers;
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
