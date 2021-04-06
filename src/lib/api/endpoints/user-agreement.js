'use strict';

const { SERVER_REF } = require('../../constants');
const logger = require('../../logger').get('api:user-agreement');

const tagPattern = tag =>
	new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'ig');
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body/i; //no g
const SHOULD_REDIRECT = RegExp.prototype.test.bind(/\/view/);

const self = Object.assign(exports, {
	default: register,
	copyRequestHeaders,
	handleFetch,
	handleFetchResponse,
	processAndRespond,
	getServeUserAgreement,
	resolveUrl,
});

function register(api, config, routeFactory) {
	api.get(/^\/user-agreement/, self.getServeUserAgreement(config));
}

function getServeUserAgreement(config) {
	return async function handler(req, res, next) {
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
					await fetcher(o),
					o.context,
					o.isInternal
				)
			);
		} catch (e) {
			if (e !== res) {
				next(e);
			}
		}
	};
}

async function resolveUrl(request, config, server) {
	//TOS_NOT_ACCEPTED = content.initial_tos_page
	const { TOS_NOT_ACCEPTED, getLink } = await import('@nti/lib-interfaces');
	const { ['user-agreement']: fallbackUrl } = config || {};
	const SERVER_CONTEXT = request;
	const { host } = request.headers;
	const pong = await server.get('logon.ping', SERVER_CONTEXT);
	let url = getLink(pong, TOS_NOT_ACCEPTED);
	logger.debug(`pong: ${TOS_NOT_ACCEPTED}: "${url}"`);
	logger.debug(`fallback (from config): ${fallbackUrl}"`);

	if (url || fallbackUrl) {
		url = new URL(
			url || fallbackUrl,
			`${request.protocol}://${host}`
		).toString();
	}

	const isInternal = x => x && new URL(x, 'null:/').host === host;

	logger.debug('Resolved url: %s', url);

	//If there is a @NamedLink we have to pass request context,
	//if its an external link like docs.google... blank out context.
	const context = isInternal(url)
		? { headers: self.copyRequestHeaders(request), redirect: 'manual' }
		: void 0;

	logger.debug('Passing request context? ', context ? 'yes' : 'no');

	return !url
		? void 0
		: {
				isInternal,
				url,
				context,
		  };
}

function copyRequestHeaders(req) {
	const blacklist = [
		'accept-encoding',
		'content-length',
		'content-type',
		'referer',
	];

	const headers = { ...((req || {}).headers || {}) };
	for (let header of blacklist) {
		delete headers[header];
	}

	return headers;
}

function handleFetch(request, response) {
	return ({ url, context }) => {
		if (SHOULD_REDIRECT(request.url)) {
			logger.debug('Redirecting... %s', url);
			response.redirect(url);
			throw response;
		}

		logger.debug('Fetching %s...', url);
		return fetch(url, context);
	};
}

function handleFetchResponse(response, context, isInternal = () => false) {
	logger.debug('Handling response: (%s) %s', response.status, response.url);
	if (!response.ok) {
		if (response.status >= 300 && response.status < 400) {
			const redirectURL = response.headers.get('location');
			const ctx = isInternal(redirectURL) ? context : void 0;
			logger.debug('Attempting to follow redirect %s...', redirectURL);
			logger.debug('Context for "%s": %o', redirectURL, ctx);
			return fetch(redirectURL, ctx).then(r =>
				self.handleFetchResponse(r, context, isInternal)
			);
		}

		logger.debug('Response NOT OK: %o', response);
		return Promise.reject(new Error(response.statusText));
	}

	return response.text();
}

function processAndRespond(response) {
	return raw => {
		const filtered = raw
			.replace(tagPattern('script'), '')
			.replace(tagPattern('style'), '');

		const body = BODY_REGEX.exec(filtered);
		const styles = [];

		const stylePattern = tagPattern('style');
		for (let m; (m = stylePattern.exec(raw)); ) {
			styles.push(m[1]);
		}

		const data = {
			// html: response,
			body: body && body[1],
			styles: styles.join('\n\n'),
		};

		response.status(200);
		response.json(data);
		response.end();
	};
}
