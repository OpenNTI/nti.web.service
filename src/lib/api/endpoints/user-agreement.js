'use strict';
const Url = require('url');
const {TOS_NOT_ACCEPTED, getLink} = require('nti-lib-interfaces');

const tagPattern = tag => new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'ig');
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body/i;//no g
const SHOULD_REDIRECT = RegExp.prototype.test.bind(/\/view/);


function copyRequestHeaders (req) {
	const blacklist = ['accept-encoding', 'content-length', 'content-type', 'referer'];

	const headers = Object.assign({}, req.headers || {});
	for (let header of blacklist) {
		delete headers[header];
	}

	return headers;
}


class ServeUserAgreement {
	constructor (config, server) {
		Object.assign(this, {
			host: config.server,
			server,
			url: config['user-agreement']
		});
	}

	handle (req, res) {
		const SERVER_CONTEXT = req;

		function handleFetchResponse (res) {
			if (!res.ok) {
				if (res.status >= 300 && res.status < 400) {
					const redirectURL = res.headers.get('location');
					return fetch(redirectURL).then(handleFetchResponse);
				}

				return Promise.reject(new Error(res.statusText));
			}

			return res.text();
		}


		function processAndRespond (raw) {

			let filtered = raw
					.replace(tagPattern('script'), '')
					.replace(tagPattern('style'), '');


			let body = BODY_REGEX.exec(filtered);
			let styles = [];
			let m;

			let stylePattern = tagPattern('style');
			while ((m = stylePattern.exec(raw))) {
				styles.push(m[1]);
			}

			let data = {
				// html: response,
				body: body && body[1],
				styles: styles.join('\n\n')
			};

			res.status(raw.statusCode || 200);
			res.json(data);
			res.end();
		}


		this.server.get('logon.ping', SERVER_CONTEXT)
			.then(pong => getLink(pong, TOS_NOT_ACCEPTED))

			//If there is a @NamedLink we have to pass request context,
			//if its an external link like docs.google... blank out context.
			.then(url => {
				if (!url) {
					SERVER_CONTEXT = {};
					url = this.url;
				}
				return Url.parse(this.host).resolve(url || '');
			})

			.then(url => url || Promise.reject(new Error('No user-agreement url set')))

			.then(url => {

				if (SHOULD_REDIRECT(req.url)) {
					res.redirect(url);
					return;
				}

				return fetch(url, {headers: copyRequestHeaders(req), redirect: 'manual'})
					.then(handleFetchResponse)
					.then(processAndRespond);

			})

			.catch(e => {
				res.status(500);
				res.json({body: e.stack || e.message || e});
				res.end();
			});
	}
}


module.exports = function register (api, config, server) {
	let handler = new ServeUserAgreement(config, server);
	api.get(/^\/user-agreement/, (req, res) => handler.handle(req, res));
};
