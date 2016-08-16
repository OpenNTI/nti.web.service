'use strict';
const {TOS_NOT_ACCEPTED, getLink} = require('nti-lib-interfaces');

const tagPattern = tag => new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'ig');
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body/i;//no g
const SHOULD_REDIRECT = RegExp.prototype.test.bind(/\/view/);


class ServeUserAgreement {
	constructor (config, server) {
		Object.assign(this, {
			host: config.server,
			server,
			url: config['user-agreement']
		});
	}

	handle (req, res) {
		let SERVER_CONTEXT = req;
		this.server.get('logon.ping', SERVER_CONTEXT)
			.then(pong => getLink(pong, TOS_NOT_ACCEPTED))

			//If there is a @NamedLink we have to pass request context,
			//if its an external link like docs.google... blank out context.
			.then(url => {
				if (!url) {
					SERVER_CONTEXT = {};
					url = this.url;
				}
				return url;
			})

			.then(url => url || Promise.reject(new Error('No user-agreement url set')))

			.then(url => {

				if (SHOULD_REDIRECT(req.url)) {
					res.redirect(url);
					return;
				}

				return this.server.get(url, SERVER_CONTEXT).then(raw => {

					let filtered = raw
							.replace(tagPattern('script'), '')
							.replace(tagPattern('style'), '');


					let body = BODY_REGEX.exec(filtered);//don't reuse stylePattern (its been consumed)
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
				});

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
