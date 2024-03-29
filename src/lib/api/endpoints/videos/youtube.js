'use strict';

const util = require('util');

const memored = require('memored');

const logger = require('../../../logger').get('videos:youtube');

const getSourceURL = id => 'https://www.youtube.com/embed/${id}';

const read = util.promisify(memored.read.bind(memored));

exports.default = function register(api, config) {
	api.get(/^\/youtube/, async (req, res, next) => {
		const key = Buffer.from(JSON.stringify(req.query)).toString('base64');
		const { id } = req.query;
		logger.info('%s Resolving Video data for %s', key, id);

		try {
			let r = (await getCached(key)) || (await resolve(key, id, req));

			res.status(r.status || 200);

			logger.debug('%s Responded: %s', key, r.status);

			for (let [h, value] of r.headers) {
				logger.debug('%s [header] %s: %s', key, h, value);
				// res.set(h, value);
			}

			logger.debug('%s Reading response body...', key);
			const data = await r.json();

			if (r.status === 200) {
				logger.info('%s Storing video data in cache', key);
				memored.store(key, data);
			}

			res.json(data);
			res.end();

			logger.debug('%s Done.', key);
		} catch (e) {
			logger.error('%s Oops...', key, e);
			next(e);
		}
	});

	async function getCached(key) {
		try {
			logger.debug('%s Checking cache...', key);
			const data = await read(key);
			logger.debug('%s Was cached? %d', key, data ? 'yes' : 'no');
			return (
				data && {
					headers: [],
					status: false,
					json: async () => data,
				}
			);
		} catch (e) {
			logger.error('%s Error: ', key, e);
		}
	}

	async function resolve(key, id, req) {
		const {
			Models: {
				media: { MediaSourceFactory, MetaDataResolver },
			},
		} = await import('@nti/lib-interfaces');
		const {
			url: { appendQueryParams },
		} = await import('@nti/lib-commons');

		const service = req.ntiService;

		const source = await MediaSourceFactory.from(service, getSourceURL(id));
		const resolver = MetaDataResolver.getProvider(source);

		const uri = appendQueryParams(
			await resolver.resolveURL(service, id),
			req.query
		);

		logger.info('%s Requesting %s...', key, uri);
		return await fetch(uri, {
			headers: {
				Referer:
					req.header('Referer') ||
					origin(
						'https://' +
							req.headers.host +
							(req.originalUrl || req.url)
					),
			},
		});
	}

	function origin(uri) {
		return Object.assign(new URL(uri), {
			hash: '',
			search: '',
			pathname: '',
		}).toString();
	}
};
